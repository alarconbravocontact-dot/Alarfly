const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');
const { determineInvoiceStatus } = require('./ar-invoices.rules');

const { Decimal } = Prisma;

// Función pura: ajusta el total de la factura original (nunca el
// paidAmount, que es cobro real en efectivo) según el tipo de nota.
// CREDIT reduce lo facturado (ej. devolución); DEBIT lo aumenta (ej.
// cargo adicional). Reutiliza determineInvoiceStatus — el mismo
// cálculo de estado que ya usa un cobro normal.
function applyCreditNoteToInvoice(type, amount, invoice) {
  const noteAmount = new Decimal(amount);
  if (noteAmount.isNegative() || noteAmount.isZero()) {
    throw new AppError('El monto de la nota debe ser mayor a cero.', 400, 'INVALID_CREDIT_NOTE_AMOUNT');
  }

  const currentTotal = new Decimal(invoice.totalAmount);
  const newTotalAmount = type === 'CREDIT' ? currentTotal.minus(noteAmount) : currentTotal.plus(noteAmount);

  if (newTotalAmount.isNegative()) {
    throw new AppError(
      `Esta nota de crédito (${noteAmount.toFixed(2)}) supera el total de la factura (${currentTotal.toFixed(2)}).`,
      400,
      'CREDIT_NOTE_EXCEEDS_INVOICE_TOTAL'
    );
  }

  const newStatus = determineInvoiceStatus(newTotalAmount, invoice.paidAmount);
  return { newTotalAmount, newStatus };
}

module.exports = { applyCreditNoteToInvoice };
