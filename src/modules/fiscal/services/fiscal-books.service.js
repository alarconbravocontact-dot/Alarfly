const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');

const { Decimal } = Prisma;

async function getBook(companyId, type, from, to) {
  const transactions = await prisma.fiscalTransaction.findMany({
    where: { companyId, type, date: { gte: from, lte: to } },
    include: { jurisdiction: true, taxRate: true, withholdingRate: true },
    orderBy: { date: 'asc' },
  });

  let totalBase = new Decimal(0);
  let totalTax = new Decimal(0);
  let totalWithholding = new Decimal(0);

  const lines = transactions.map((transaction) => {
    totalBase = totalBase.plus(transaction.taxBase);
    totalTax = totalTax.plus(transaction.taxAmount);
    totalWithholding = totalWithholding.plus(transaction.withholdingAmount);
    return {
      id: transaction.id,
      date: transaction.date,
      documentNumber: transaction.documentNumber,
      counterpartyName: transaction.counterpartyName,
      counterpartyTaxId: transaction.counterpartyTaxId,
      taxRateName: transaction.taxRate?.name || null,
      withholdingRateName: transaction.withholdingRate?.name || null,
      taxBase: transaction.taxBase.toFixed(2),
      taxAmount: transaction.taxAmount.toFixed(2),
      withholdingAmount: transaction.withholdingAmount.toFixed(2),
    };
  });

  return { totalBase, totalTax, totalWithholding, lines };
}

// Fase 7 (secciones 16/43): las notas de crédito/débito NUNCA vuelven
// a pasar por el motor fiscal (decisión ya tomada — ver
// ar-credit-notes.service.js), así que nunca generan ni ajustan una
// FiscalTransaction. Sin esto, el libro fiscal quedaba ciego a
// cualquier nota emitida en el periodo — un hueco real para una
// declaración de IVA real. Se muestran en su propia sección, con su
// monto tal cual (no se reparte en base/impuesto: una nota de crédito
// es un ajuste simple sobre el total ya facturado, nunca tuvo ese
// desglose — inventar uno sería fabricar un dato que no existe). El
// libro nunca las mezcla con las líneas de FiscalTransaction, para no
// sugerir una precisión que no hay.
async function getCreditNotesForBook(companyId, type, from, to) {
  if (type === 'SALE') {
    const notes = await prisma.arCreditNote.findMany({
      where: { companyId, date: { gte: from, lte: to } },
      include: { customer: true, invoice: true },
      orderBy: { date: 'asc' },
    });
    return notes.map((note) => ({
      id: note.id,
      date: note.date,
      noteNumber: note.noteNumber,
      type: note.type,
      counterpartyName: note.customer.name,
      relatedDocumentNumber: note.invoice.invoiceNumber,
      reason: note.reason,
      amount: note.amount.toFixed(2),
    }));
  }
  const notes = await prisma.apCreditNote.findMany({
    where: { companyId, date: { gte: from, lte: to } },
    include: { vendor: true, bill: true },
    orderBy: { date: 'asc' },
  });
  return notes.map((note) => ({
    id: note.id,
    date: note.date,
    noteNumber: note.noteNumber,
    type: note.type,
    counterpartyName: note.vendor.name,
    relatedDocumentNumber: note.bill.billNumber,
    reason: note.reason,
    amount: note.amount.toFixed(2),
  }));
}

async function buildBookWithNotes(companyId, type, from, to) {
  const { totalBase, totalTax, totalWithholding, lines } = await getBook(companyId, type, from, to);
  const creditNotes = await getCreditNotesForBook(companyId, type, from, to);

  // CREDIT reduce lo facturado/comprado (mismo signo que
  // applyCreditNoteToInvoice/applyCreditNoteToBill); DEBIT lo aumenta.
  const netCreditNoteEffect = creditNotes.reduce((sum, note) => {
    const amount = new Decimal(note.amount);
    return note.type === 'CREDIT' ? sum.minus(amount) : sum.plus(amount);
  }, new Decimal(0));

  return {
    type,
    from,
    to,
    lines,
    totalBase: totalBase.toFixed(2),
    totalTax: totalTax.toFixed(2),
    totalWithholding: totalWithholding.toFixed(2),
    creditNotes,
    netCreditNoteEffect: netCreditNoteEffect.toFixed(2),
    // Total bruto facturado (base+impuesto) ajustado por las notas del
    // periodo — la cifra que de verdad importa para una declaración
    // real, nunca antes visible en el libro.
    netTotal: totalBase.plus(totalTax).plus(netCreditNoteEffect).toFixed(2),
  };
}

async function getSalesBook(companyId, { from, to }) {
  return buildBookWithNotes(companyId, 'SALE', from, to);
}

async function getPurchasesBook(companyId, { from, to }) {
  return buildBookWithNotes(companyId, 'PURCHASE', from, to);
}

async function getWithholdingsSummary(companyId, { from, to }) {
  const transactions = await prisma.fiscalTransaction.findMany({
    where: { companyId, date: { gte: from, lte: to }, withholdingAmount: { gt: 0 } },
    include: { withholdingRate: true },
  });

  const byRate = new Map();
  for (const transaction of transactions) {
    const key = transaction.withholdingRateId || 'sin-tasa';
    const current = byRate.get(key) || {
      rateId: transaction.withholdingRateId,
      rateName: transaction.withholdingRate?.name || 'Sin tasa asignada',
      total: new Decimal(0),
      count: 0,
    };
    current.total = current.total.plus(transaction.withholdingAmount);
    current.count += 1;
    byRate.set(key, current);
  }

  return {
    from,
    to,
    rates: Array.from(byRate.values()).map((entry) => ({
      rateId: entry.rateId,
      rateName: entry.rateName,
      total: entry.total.toFixed(2),
      count: entry.count,
    })),
  };
}

// Punto 3: compara lo que dice el libro fiscal contra el movimiento
// real de la cuenta contable configurada en cada tasa (TaxRate.glAccountId),
// dentro del mismo periodo. Reutiliza AccountingPeriod, que ya existe
// — no se inventa un "periodo fiscal" aparte.
async function reconcilePeriod(companyId, periodId) {
  const period = await prisma.accountingPeriod.findFirst({ where: { id: periodId, companyId } });
  if (!period) {
    throw new AppError('El periodo contable indicado no existe.', 404, 'PERIOD_NOT_FOUND');
  }

  const rates = await prisma.taxRate.findMany({ where: { companyId, glAccountId: { not: null } } });

  const results = [];
  for (const rate of rates) {
    const isWithholding = rate.type === 'WITHHOLDING';

    const fiscalSum = await prisma.fiscalTransaction.aggregate({
      where: {
        companyId,
        date: { gte: period.startDate, lte: period.endDate },
        ...(isWithholding ? { withholdingRateId: rate.id } : { taxRateId: rate.id }),
      },
      _sum: isWithholding ? { withholdingAmount: true } : { taxAmount: true },
    });
    const fiscalAmount = new Decimal((isWithholding ? fiscalSum._sum.withholdingAmount : fiscalSum._sum.taxAmount) || 0);

    const account = await prisma.account.findUnique({ where: { id: rate.glAccountId } });
    const ledgerSum = await prisma.journalEntryLine.aggregate({
      where: {
        accountId: rate.glAccountId,
        journalEntry: { companyId, status: 'APPROVED', date: { gte: period.startDate, lte: period.endDate } },
      },
      _sum: { debit: true, credit: true },
    });
    const debit = new Decimal(ledgerSum._sum.debit || 0);
    const credit = new Decimal(ledgerSum._sum.credit || 0);
    const ledgerMovement = account.normalBalance === 'CREDIT' ? credit.minus(debit) : debit.minus(credit);
    // El monto fiscal siempre se guarda en positivo; se compara contra
    // el valor absoluto del movimiento contable para no depender de si
    // la cuenta es de naturaleza débito o crédito.
    const ledgerAmount = ledgerMovement.abs();
    const difference = fiscalAmount.minus(ledgerAmount);

    results.push({
      taxRateId: rate.id,
      taxRateName: rate.name,
      glAccountId: rate.glAccountId,
      fiscalAmount: fiscalAmount.toFixed(2),
      ledgerAmount: ledgerAmount.toFixed(2),
      difference: difference.toFixed(2),
      matches: difference.abs().lessThan(0.01),
    });
  }

  return { periodId, periodName: period.name, results };
}

module.exports = { getSalesBook, getPurchasesBook, getWithholdingsSummary, reconcilePeriod };
