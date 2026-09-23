// Notas de Crédito y Débito a proveedores, siempre ligadas a una
// factura de compra original. Espejo de
// accounts-receivable/services/ar-credit-notes.service.js, con una
// pieza nueva que AR dejó sin conectar en ningún flujo real (ver
// CLAUDE.md, fila 2026-07-15): cuando la nota SÍ representa una
// devolución física, acá se genera de verdad la salida real de
// inventario (VENDOR_RETURN_EXIT, vía inventory-movements.createExit,
// nunca reimplementado) y se liga con relatedInventoryMovementId —
// integración mínima, tal como pidió el punto 29: no hay flujo de
// inspección/calidad, solo el movimiento real.
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const ledgerService = require('../../../core/ledger/ledger.service');
const arApSettingsService = require('../../../core/ar-ap-settings/ar-ap-settings.service');
const inventoryMovementsService = require('../../inventory/services/inventory-movements.service');
const { applyCreditNoteToBill } = require('./ap-credit-notes.rules');
const { withTransaction } = require('../../../core/database/unit-of-work');

async function createCreditNote(companyId, userId, data) {
  const bill = await prisma.apBill.findFirst({ where: { id: data.billId, companyId }, include: { vendor: true } });
  if (!bill) {
    throw new AppError('La factura indicada no existe.', 404, 'BILL_NOT_FOUND');
  }
  if (bill.status === 'CANCELLED') {
    throw new AppError('No se puede emitir una nota sobre una factura cancelada.', 400, 'BILL_CANCELLED');
  }

  const { newTotalAmount, newStatus } = applyCreditNoteToBill(data.type, data.amount, bill);
  const payableGlAccountId = await arApSettingsService.assertPayableAccountConfigured(companyId);

  // CREDIT: reduce lo que se debe (débito Cuentas por Pagar) / reduce
  // el gasto/activo que ya se había debitado al facturar (crédito
  // expenseAccountId). DEBIT: al revés — aumenta el gasto (débito
  // expenseAccountId) / aumenta lo que se debe (crédito Cuentas por
  // Pagar).
  const lines =
    data.type === 'CREDIT'
      ? [
          { accountId: payableGlAccountId, debit: Number(data.amount), credit: 0 },
          { accountId: bill.expenseAccountId, debit: 0, credit: Number(data.amount) },
        ]
      : [
          { accountId: bill.expenseAccountId, debit: Number(data.amount), credit: 0 },
          { accountId: payableGlAccountId, debit: 0, credit: Number(data.amount) },
        ];

  // Fase 1: asiento + nota + actualización de la factura (+ devolución
  // física real, si aplica) en una sola transacción.
  return withTransaction(async (tx) => {
    let relatedInventoryMovementId = null;
    if (data.physicalReturn) {
      const movement = await inventoryMovementsService.createExit(
        companyId,
        userId,
        {
          variantId: data.physicalReturn.productVariantId,
          warehouseId: data.physicalReturn.warehouseId,
          quantity: data.physicalReturn.quantity,
          date: data.date,
          type: 'VENDOR_RETURN_EXIT',
          referenceType: 'ApCreditNote',
          referenceId: bill.id,
          notes: `Devolución a proveedor — factura ${bill.billNumber}: ${data.reason}`,
        },
        tx
      );
      relatedInventoryMovementId = movement.id;
    }

    const entry = await ledgerService.postEntry(
      {
        companyId,
        date: data.date,
        description: `Nota de ${data.type === 'CREDIT' ? 'crédito' : 'débito'} a proveedor — factura ${bill.billNumber}: ${data.reason}`,
        lines,
        origin: 'AUTOMATIC',
        sourceModule: 'accounts-payable',
        sourceReference: bill.id,
        createdByUserId: userId,
        autoApprove: true,
      },
      tx
    );

    const noteNumber = await arApSettingsService.getNextApCreditNoteNumber(companyId, tx);

    const note = await tx.apCreditNote.create({
      data: {
        companyId,
        vendorId: bill.vendorId,
        billId: bill.id,
        noteNumber,
        type: data.type,
        reason: data.reason,
        amount: data.amount,
        date: data.date,
        journalEntryId: entry.id,
        relatedInventoryMovementId,
        createdByUserId: userId,
      },
    });

    await tx.apBill.update({
      where: { id: bill.id },
      data: { totalAmount: newTotalAmount, status: newStatus },
    });

    await auditService.log(
      {
        companyId,
        userId,
        action: 'ap_credit_note.created',
        entityType: 'ApCreditNote',
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
  const note = await prisma.apCreditNote.findFirst({
    where: { id, companyId },
    include: { vendor: true, bill: true, journalEntry: true, relatedInventoryMovement: true },
  });
  if (!note) {
    throw new AppError('La nota indicada no existe.', 404, 'AP_CREDIT_NOTE_NOT_FOUND');
  }
  return note;
}

async function listCreditNotes(companyId, { vendorId, billId, type } = {}) {
  return prisma.apCreditNote.findMany({
    where: { companyId, vendorId: vendorId || undefined, billId: billId || undefined, type: type || undefined },
    include: { vendor: true, bill: true },
    orderBy: { date: 'desc' },
  });
}

module.exports = { createCreditNote, getCreditNote, listCreditNotes };
