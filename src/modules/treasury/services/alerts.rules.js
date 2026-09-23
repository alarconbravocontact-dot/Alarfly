const { Prisma } = require('@prisma/client');
const { daysUntil, detectDueSoon, severityForDueSoon } = require('../../../core/alerts/alerts.rules');

const { Decimal } = Prisma;

// Funciones puras propias de Tesorería (saldo bajo, tarjeta cerca del
// límite): las de vencimiento por fecha son genéricas y viven en
// core/alerts, reutilizadas aquí con sus nombres históricos.

function detectLowBalance(currentBalance, threshold) {
  if (threshold === null || threshold === undefined) return false;
  return new Decimal(currentBalance).lessThan(threshold);
}

function detectCreditCardNearLimit(currentBalance, creditLimit, warningPercentage) {
  if (!creditLimit) return false;
  const usageRatio = new Decimal(currentBalance).dividedBy(creditLimit).times(100);
  return usageRatio.greaterThanOrEqualTo(warningPercentage);
}

// Punto 9, parte que quedó bloqueada esperando AR: un cliente tiene
// "atraso recurrente" cuando tiene varias facturas vencidas al mismo
// tiempo (no solo una que se le pasó por descuido) — el umbral de
// cuántas cuentan como "recurrente" es configurable por regla.
function detectRecurringLateCustomer(overdueInvoiceCount, minOccurrences) {
  return overdueInvoiceCount >= minOccurrences;
}

module.exports = {
  detectLowBalance,
  detectCreditCardNearLimit,
  detectRecurringLateCustomer,
  detectPaymentDueSoon: detectDueSoon,
  severityForPaymentDueSoon: severityForDueSoon,
  daysUntil,
};
