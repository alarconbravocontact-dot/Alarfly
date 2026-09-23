const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');

const { Decimal } = Prisma;

// Función pura: consume capas de costo (FIFO o LIFO) hasta cubrir la
// cantidad pedida, y devuelve el costo unitario ponderado de esa
// salida — nunca muta las capas originales, el servicio decide cómo
// aplicar el resultado (reducir remainingQuantity de cada capa).
function consumeCostLayers(layers, quantityToConsume, method) {
  const sorted = [...layers].sort((a, b) => {
    const diff = new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime();
    return method === 'LIFO' ? -diff : diff;
  });

  let remaining = new Decimal(quantityToConsume);
  const consumptions = [];
  let totalCost = new Decimal(0);

  for (const layer of sorted) {
    if (remaining.isZero()) break;
    const available = new Decimal(layer.remainingQuantity);
    if (available.isZero() || available.isNegative()) continue;

    const consumeQty = Decimal.min(available, remaining);
    consumptions.push({ layerId: layer.id, quantity: consumeQty, unitCost: new Decimal(layer.unitCost) });
    totalCost = totalCost.plus(consumeQty.times(layer.unitCost));
    remaining = remaining.minus(consumeQty);
  }

  if (remaining.greaterThan(0)) {
    throw new AppError(
      `No hay suficiente stock en las capas de costo para cubrir la salida (faltan ${remaining.toFixed(4)} unidades).`,
      400,
      'INSUFFICIENT_STOCK_LAYERS'
    );
  }

  const totalQuantity = new Decimal(quantityToConsume);
  const averageUnitCost = totalQuantity.isZero() ? new Decimal(0) : totalCost.dividedBy(totalQuantity);

  return { consumptions, totalCost, averageUnitCost };
}

// Función pura: nuevo costo promedio ponderado (PMP) tras una entrada.
function calculateWeightedAverageCost(currentQuantity, currentAverageCost, incomingQuantity, incomingUnitCost) {
  const newQuantity = new Decimal(currentQuantity).plus(incomingQuantity);
  if (newQuantity.isZero()) return new Decimal(0);

  const currentValue = new Decimal(currentQuantity).times(currentAverageCost);
  const incomingValue = new Decimal(incomingQuantity).times(incomingUnitCost);
  return currentValue.plus(incomingValue).dividedBy(newQuantity);
}

// Función pura: stock disponible = físico - reservado.
function calculateAvailableStock(quantityOnHand, quantityReserved) {
  return new Decimal(quantityOnHand).minus(quantityReserved);
}

module.exports = { consumeCostLayers, calculateWeightedAverageCost, calculateAvailableStock };
