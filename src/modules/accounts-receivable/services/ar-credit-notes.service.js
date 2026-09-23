// Notas de Crédito y Débito, siempre ligadas a una factura original.
// Al emitirlas, se postea el asiento contable directo vía
// core/ledger.postEntry (mismo motor de siempre, nunca uno propio) y
// se ajusta el total de la factura — no el paidAmount, que es cobro
// real en efectivo. No vuelve a pasar por el motor fiscal: es un
// ajuste simple sobre lo ya facturado, tal como se pidió ("generar el
// asiento contable correspondiente vía accounting").
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const ledgerService = require('../../../core/ledger/ledger.service');
const arApSettingsService = require('../../../core/ar-ap-settings/ar-ap-settings.service');
const { applyCreditNoteToInvoice } = require('./ar-credit-notes.rules');

async function createCreditNote(companyId, userId, data) {
  const invoice = await prisma.arInvoice.findFirst({ where: { id: data.invoiceId, companyId } });
  if (!invoice) {
    throw new AppError('La factura indicada no existe.', 404, 'INVOICE_NOT_FOUND');
  }
  if (invoice.status === 'CANCELLED') {
    throw new AppError('No se puede emitir una nota sobre una factura cancelada.', 400, 'INVOICE_CANCELLED');
  }

  const { newTotalAmount, newStatus } = applyCreditNoteToInvoice(data.type, data.amount, invoice);
  const receivableGlAccountId = await arApSettingsService.assertReceivableAccountConfigured(companyId);

  // CREDIT: reduce ingreso (débito ingreso) / reduce lo que debe el
  // cliente (crédito AR). DEBIT: al revés — aumenta lo que debe
  // (débito AR) / aumenta ingreso (crédito ingreso).
  const lines =
    data.type === 'CREDIT'
      ? [
          { accountId: invoice.incomeAccountId, debit: Number(data.amount), credit: 0 },
          { accountId: receivableGlAccountId, debit: 0, credit: Number(data.amount) },
        ]
      : [
          { accountId: receivableGlAccountId, debit: Number(data.amount), credit: 0 },
          { accountId: invoice.incomeAccountId, debit: 0, credit: Number(data.amount) },
        ];

  const entry = await ledgerService.postEntry({
    companyId,
    date: data.date,
    description: `Nota de ${data.type === 'CREDIT' ? 'crédito' : 'débito'} — factura ${invoice.invoiceNumber}: ${data.reason}`,
    lines,
    origin: 'AUTOMATIC',
    sourceModule: 'accounts-receivable',
    sourceReference: invoice.id,
    createdByUserId: userId,
    autoApprove: true,
  });

  const noteNumber = await arApSettingsService.getNextArCreditNoteNumber(companyId);

  return prisma.$transaction(async (tx) => {
    const note = await tx.arCreditNote.create({
      data: {
        companyId,
        customerId: invoice.customerId,
        invoiceId: invoice.id,
        noteNumber,
        type: data.type,
        reason: data.reason,
        amount: data.amount,
        date: data.date,
        journalEntryId: entry.id,
        createdByUserId: userId,
      },
    });

    await tx.arInvoice.update({
      where: { id: invoice.id },
      data: { totalAmount: newTotalAmount, status: newStatus },
    });

    await auditService.log(
      {
        companyId,
        userId,
        action: 'ar_credit_note.created',
        entityType: 'ArCreditNote',
        entityId: note.id,
        oldValue: null,
        newValue: note,
      },
      tx
    );

    return note;
  });
}

async function getCreditNote(companyId, id) {
  const note = await prisma.arCreditNote.findFirst({
    where: { id, companyId },
    include: { customer: true, invoice: true, journalEntry: true },
  });
  if (!note) {
    throw new AppError('La nota indicada no existe.', 404, 'AR_CREDIT_NOTE_NOT_FOUND');
  }
  return note;
}

async function listCreditNotes(companyId, { customerId, invoiceId, type } = {}) {
  return prisma.arCreditNote.findMany({
    where: { companyId, customerId: customerId || undefined, invoiceId: invoiceId || undefined, type: type || undefined },
    include: { customer: true, invoice: true },
    orderBy: { date: 'desc' },
  });
}

module.exports = { createCreditNote, getCreditNote, listCreditNotes };
