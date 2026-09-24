const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');

const { Decimal } = Prisma;

// Función pura: fecha de vencimiento = fecha de emisión + días de
// plazo del cliente.
function calculateDueDate(issueDate, paymentTermsDays) {
  const due = new Date(issueDate);
  due.setUTCDate(due.getUTCDate() + paymentTermsDays);
  return due;
}

// Función pura: decide el estado de una factura según lo pagado.
// Fase 7 (secciones 16/26/61): el chequeo de "ya está saldada" va
// PRIMERO — antes vivía después de `paid.isZero()`, así que una
// factura reducida a $0 por una nota de crédito total (nunca cobrada,
// paid=0 también) leía "OPEN" en vez de "PAID". Una nota de crédito
// por el 100% es la forma ya existente en el proyecto de "revertir"
// una factura (nunca se borra, se ajusta con su propio asiento — mismo
// criterio que core/ledger.reverseEntry) y necesita que el estado
// resultante refleje correctamente que ya no queda nada pendiente.
function determineInvoiceStatus(totalAmount, paidAmount) {
  const total = new Decimal(totalAmount);
  const paid = new Decimal(paidAmount);
  if (paid.greaterThanOrEqualTo(total)) return 'PAID';
  if (paid.isZero()) return 'OPEN';
  return 'PARTIALLY_PAID';
}

// Función pura: valida y reparte un cobro entre una o varias facturas.
// - La suma de lo aplicado debe ser exactamente el monto del pago (no
//   se admite "sobrante sin aplicar" en esta primera versión).
// - Ninguna aplicación puede superar el saldo pendiente de su factura.
function applyPaymentToInvoices(paymentAmount, applications, invoicesById) {
  if (!Array.isArray(applications) || applications.length === 0) {
    throw new AppError('Debes indicar a qué factura(s) se aplica el cobro.', 400, 'APPLICATIONS_REQUIRED');
  }

  let totalApplied = new Decimal(0);
  const results = [];

  for (const application of applications) {
    const invoice = invoicesById.get(application.invoiceId);
    if (!invoice) {
      throw new AppError(`La factura "${application.invoiceId}" no existe o no pertenece a este cliente.`, 404, 'INVOICE_NOT_FOUND');
    }
    const amount = new Decimal(application.amount);
    if (amount.isNegative() || amount.isZero()) {
      throw new AppError('El monto aplicado a una factura debe ser mayor a cero.', 400, 'INVALID_APPLICATION_AMOUNT');
    }
    const remaining = new Decimal(invoice.totalAmount).minus(invoice.paidAmount);
    if (amount.greaterThan(remaining)) {
      throw new AppError(
        `El monto aplicado a la factura ${invoice.invoiceNumber} (${amount.toFixed(2)}) supera su saldo pendiente (${remaining.toFixed(2)}).`,
        400,
        'APPLICATION_EXCEEDS_BALANCE'
      );
    }

    totalApplied = totalApplied.plus(amount);
    const newPaidAmount = new Decimal(invoice.paidAmount).plus(amount);
    results.push({
      invoiceId: invoice.id,
      amount,
      newPaidAmount,
      newStatus: determineInvoiceStatus(invoice.totalAmount, newPaidAmount),
    });
  }

  if (!totalApplied.equals(paymentAmount)) {
    throw new AppError(
      `La suma de lo aplicado (${totalApplied.toFixed(2)}) debe ser igual al monto del cobro (${new Decimal(paymentAmount).toFixed(2)}).`,
      400,
      'APPLICATION_TOTAL_MISMATCH'
    );
  }

  return results;
}

// Función pura: valida el crédito de un cliente antes de facturarlo.
// Revisa, en este orden, bloqueo manual/automático, límite de crédito
// (saldo pendiente actual + esta factura) y días de atraso máximo
// permitido (la factura vencida más atrasada que tenga hoy). Cualquier
// campo de umbral en `null` significa "sin restricción" — no bloquea.
function assertCustomerCreditOk({ customer, currentOpenBalance, newInvoiceAmount, maxDaysOverdueFound }) {
  if (customer.isBlocked) {
    throw new AppError(
      `El cliente "${customer.name}" está bloqueado para nuevas facturas${customer.blockedReason ? `: ${customer.blockedReason}` : '.'}`,
      400,
      'CUSTOMER_BLOCKED'
    );
  }

  if (customer.creditLimit != null) {
    const projectedBalance = new Decimal(currentOpenBalance).plus(newInvoiceAmount);
    if (projectedBalance.greaterThan(customer.creditLimit)) {
      throw new AppError(
        `Esta factura dejaría al cliente "${customer.name}" con un saldo de ${projectedBalance.toFixed(
          2
        )}, que supera su límite de crédito de ${new Decimal(customer.creditLimit).toFixed(2)}.`,
        400,
        'CREDIT_LIMIT_EXCEEDED'
      );
    }
  }

  if (customer.maxOverdueDaysAllowed != null && maxDaysOverdueFound != null && maxDaysOverdueFound > customer.maxOverdueDaysAllowed) {
    throw new AppError(
      `El cliente "${customer.name}" tiene facturas vencidas hace ${maxDaysOverdueFound} días, más de los ${customer.maxOverdueDaysAllowed} días permitidos antes de poder facturarle de nuevo.`,
      400,
      'CUSTOMER_OVERDUE_LIMIT_EXCEEDED'
    );
  }
}

// Función pura: agrupa facturas de venta por mes (según issueDate) para
// el gráfico de comportamiento de ventas del Panel principal. Siempre
// devuelve `months` puntos consecutivos terminando en el mes de
// `referenceDate`, en 0 si no hubo facturas ese mes — así el gráfico
// nunca "salta" un mes sin datos.
function buildSalesTrend(invoices, months, referenceDate) {
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const bucketDate = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - i, 1));
    buckets.push({
      key: `${bucketDate.getUTCFullYear()}-${String(bucketDate.getUTCMonth() + 1).padStart(2, '0')}`,
      monthStart: bucketDate,
      totalSales: new Decimal(0),
      invoiceCount: 0,
    });
  }
  const bucketByKey = new Map(buckets.map((b) => [b.key, b]));

  for (const invoice of invoices) {
    const issueDate = new Date(invoice.issueDate);
    const key = `${issueDate.getUTCFullYear()}-${String(issueDate.getUTCMonth() + 1).padStart(2, '0')}`;
    const bucket = bucketByKey.get(key);
    if (!bucket) continue; // fuera del rango pedido
    bucket.totalSales = bucket.totalSales.plus(invoice.totalAmount);
    bucket.invoiceCount += 1;
  }

  return buckets.map((b) => ({
    month: b.key,
    totalSales: b.totalSales.toFixed(2),
    invoiceCount: b.invoiceCount,
  }));
}

module.exports = {
  calculateDueDate,
  determineInvoiceStatus,
  applyPaymentToInvoices,
  assertCustomerCreditOk,
  buildSalesTrend,
};
