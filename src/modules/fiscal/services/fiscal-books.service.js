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

  return {
    type,
    from,
    to,
    lines,
    totalBase: totalBase.toFixed(2),
    totalTax: totalTax.toFixed(2),
    totalWithholding: totalWithholding.toFixed(2),
  };
}

async function getSalesBook(companyId, { from, to }) {
  return getBook(companyId, 'SALE', from, to);
}

async function getPurchasesBook(companyId, { from, to }) {
  return getBook(companyId, 'PURCHASE', from, to);
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
