const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');

const { Decimal } = Prisma;

// Espejo exacto de accounts-receivable/services/ar-invoices.rules.js
// (misma lógica de negocio, del lado de facturas de compra).
function calculateDueDate(issueDate, paymentTermsDays) {
  const due = new Date(issueDate);
  due.setUTCDate(due.getUTCDate() + paymentTermsDays);
  return due;
}

function determineBillStatus(totalAmount, paidAmount) {
  const total = new Decimal(totalAmount);
  const paid = new Decimal(paidAmount);
  if (paid.isZero()) return 'OPEN';
  if (paid.greaterThanOrEqualTo(total)) return 'PAID';
  return 'PARTIALLY_PAID';
}

function applyPaymentToBills(paymentAmount, applications, billsById) {
  if (!Array.isArray(applications) || applications.length === 0) {
    throw new AppError('Debes indicar a qué factura(s) se aplica el pago.', 400, 'APPLICATIONS_REQUIRED');
  }

  let totalApplied = new Decimal(0);
  const results = [];

  for (const application of applications) {
    const bill = billsById.get(application.billId);
    if (!bill) {
      throw new AppError(`La factura "${application.billId}" no existe o no pertenece a este proveedor.`, 404, 'BILL_NOT_FOUND');
    }
    const amount = new Decimal(application.amount);
    if (amount.isNegative() || amount.isZero()) {
      throw new AppError('El monto aplicado a una factura debe ser mayor a cero.', 400, 'INVALID_APPLICATION_AMOUNT');
    }
    const remaining = new Decimal(bill.totalAmount).minus(bill.paidAmount);
    if (amount.greaterThan(remaining)) {
      throw new AppError(
        `El monto aplicado a la factura ${bill.billNumber} (${amount.toFixed(2)}) supera su saldo pendiente (${remaining.toFixed(2)}).`,
        400,
        'APPLICATION_EXCEEDS_BALANCE'
      );
    }

    totalApplied = totalApplied.plus(amount);
    const newPaidAmount = new Decimal(bill.paidAmount).plus(amount);
    results.push({
      billId: bill.id,
      amount,
      newPaidAmount,
      newStatus: determineBillStatus(bill.totalAmount, newPaidAmount),
    });
  }

  if (!totalApplied.equals(paymentAmount)) {
    throw new AppError(
      `La suma de lo aplicado (${totalApplied.toFixed(2)}) debe ser igual al monto del pago (${new Decimal(paymentAmount).toFixed(2)}).`,
      400,
      'APPLICATION_TOTAL_MISMATCH'
    );
  }

  return results;
}

module.exports = { calculateDueDate, determineBillStatus, applyPaymentToBills };
