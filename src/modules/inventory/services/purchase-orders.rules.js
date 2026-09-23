const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;

// Punto 5 (Reabastecimiento): cuánto sugerir pedir para volver a
// "llenar" hasta el máximo configurado — si no hay máximo, se usa el
// doble del mínimo como meta simple (heurística consciente, no un
// pronóstico de demanda). Nunca sugiere una cantidad negativa.
function calculateSuggestedReorderQuantity(quantityOnHand, minStock, maxStock) {
  const onHand = new Decimal(quantityOnHand);
  const target = maxStock != null ? new Decimal(maxStock) : new Decimal(minStock).times(2);
  const suggested = target.minus(onHand);
  return suggested.isNegative() ? new Decimal(0) : suggested;
}

// Diferencia entre lo pedido y lo recibido — no es necesariamente un
// error (una recepción parcial es normal), solo se señala para que
// quien recibe la vea.
function calculateReceiptDiscrepancy(quantityOrdered, quantityReceived) {
  const ordered = new Decimal(quantityOrdered);
  const received = new Decimal(quantityReceived);
  const discrepancy = received.minus(ordered);
  return { discrepancy, hasDiscrepancy: !discrepancy.isZero() };
}

// Estado de la orden después de aplicar recepciones: RECEIVED si todas
// las líneas ya llegaron completas, PARTIALLY_RECEIVED si al menos una
// tiene algo recibido pero no todas están completas, o el estado
// actual si nada se ha recibido todavía.
function determinePurchaseOrderStatus(lines, currentStatus) {
  const allComplete = lines.every((line) => new Decimal(line.quantityReceived).greaterThanOrEqualTo(line.quantityOrdered));
  if (allComplete) return 'RECEIVED';
  const someReceived = lines.some((line) => new Decimal(line.quantityReceived).greaterThan(0));
  if (someReceived) return 'PARTIALLY_RECEIVED';
  return currentStatus;
}

module.exports = { calculateSuggestedReorderQuantity, calculateReceiptDiscrepancy, determinePurchaseOrderStatus };
