// Espejo exacto de accounts-receivable/services/ar-credit-notes.rules.js
// del lado de notas a proveedores.
const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');
const { determineBillStatus } = require('./ap-bills.rules');

const { Decimal } = Prisma;

// Función pura: ajusta el total de la factura original (nunca el
// paidAmount, que es pago real en efectivo) según el tipo de nota.
// CREDIT reduce lo facturado (ej. devolución a proveedor); DEBIT lo
// aumenta (ej. cargo adicional del proveedor). Reutiliza
// determineBillStatus — el mismo cálculo de estado que ya usa un pago
// normal.
function applyCreditNoteToBill(type, amount, bill) {
  const noteAmount = new Decimal(amount);
  if (noteAmount.isNegative() || noteAmount.isZero()) {
    throw new AppError('El monto de la nota debe ser mayor a cero.', 400, 'INVALID_CREDIT_NOTE_AMOUNT');
  }

  const currentTotal = new Decimal(bill.totalAmount);
  const newTotalAmount = type === 'CREDIT' ? currentTotal.minus(noteAmount) : currentTotal.plus(noteAmount);

  if (newTotalAmount.isNegative()) {
    throw new AppError(
      `Esta nota de crédito (${noteAmount.toFixed(2)}) supera el total de la factura (${currentTotal.toFixed(2)}).`,
      400,
      'CREDIT_NOTE_EXCEEDS_BILL_TOTAL'
    );
  }

  const newStatus = determineBillStatus(newTotalAmount, bill.paidAmount);
  return { newTotalAmount, newStatus };
}

module.exports = { applyCreditNoteToBill };
