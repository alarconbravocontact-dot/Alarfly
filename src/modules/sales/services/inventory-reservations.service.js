// Fase 3 (Ventas), punto 12-13: gestiona `StockLevel.quantityReserved`
// (columna que ya existía en Inventario desde su schema original, sin
// ningún flujo real que la mantuviera hasta ahora — el hueco exacto
// que señaló la auditoría). Una reserva NUNCA es una salida de
// inventario: solo mueve este contador, nunca `quantityOnHand` ni las
// capas de costo (eso solo lo toca `valuation.service`, vía
// `inventory-movements.service.createExit`, cuando de verdad se
// entrega). Disponible = físico − reservado, reutilizando
// `valuation.rules.calculateAvailableStock` tal cual, sin duplicar la
// fórmula.
//
// Un `SalesOrderLine` físico tiene como máximo UNA fila de
// `InventoryReservation` (creada al confirmar el pedido); su
// `releasedQuantity` acumula lo que se va liberando/cumpliendo — así
// la trazabilidad de "cuánto queda reservado de verdad" es siempre una
// sola fuente (esta fila), sin tener que sumar un historial de eventos
// para saberlo.
const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');
const valuationService = require('../../inventory/services/valuation.service');
const { calculateAvailableStock } = require('../../inventory/services/valuation.rules');

const { Decimal } = Prisma;

// Reserva `quantity` de `variantId` en `warehouseId` para una línea de
// pedido — rechaza si no hay disponible suficiente (físico − ya
// reservado por cualquier otra reserva). Siempre dentro de la
// transacción del llamador (confirmar un pedido es una sola operación).
async function reserveForOrderLine(tx, companyId, { orderLineId, variantId, warehouseId, quantity }) {
  const qty = new Decimal(quantity);
  const stockLevel = await valuationService.getOrCreateStockLevel(tx, companyId, variantId, warehouseId);
  const available = calculateAvailableStock(stockLevel.quantityOnHand, stockLevel.quantityReserved);

  if (available.lessThan(qty)) {
    throw new AppError(
      `No hay suficiente stock disponible para reservar (disponible: ${available.toFixed(4)}, solicitado: ${qty.toFixed(4)}).`,
      400,
      'INSUFFICIENT_AVAILABLE_STOCK'
    );
  }

  await tx.stockLevel.update({ where: { id: stockLevel.id }, data: { quantityReserved: { increment: qty } } });

  return tx.inventoryReservation.create({
    data: { companyId, orderLineId, variantId, warehouseId, quantity: qty, status: 'RESERVED' },
  });
}

// Libera (total o parcialmente) lo reservado de una línea — usado al
// cancelar un pedido/línea sin que nada se haya entregado todavía.
// Nunca toca `quantityOnHand`: lo reservado simplemente deja de
// contarse como comprometido.
async function releaseReservation(tx, reservation, quantity, { cancel = false } = {}) {
  const qty = new Decimal(quantity);
  const remaining = new Decimal(reservation.quantity).minus(reservation.releasedQuantity);
  const toRelease = Decimal.min(qty, remaining);
  if (toRelease.isZero()) return reservation;

  await tx.stockLevel.updateMany({
    where: { variantId: reservation.variantId, warehouseId: reservation.warehouseId },
    data: { quantityReserved: { decrement: toRelease } },
  });

  const newReleased = new Decimal(reservation.releasedQuantity).plus(toRelease);
  const fullyReleased = newReleased.greaterThanOrEqualTo(reservation.quantity);
  const status = fullyReleased ? (cancel ? 'CANCELLED' : 'RELEASED') : 'PARTIALLY_RELEASED';

  return tx.inventoryReservation.update({
    where: { id: reservation.id },
    data: { releasedQuantity: newReleased, status },
  });
}

// Convierte `quantity` de lo reservado en "cumplido" — se llama justo
// antes/junto con la salida real de inventario (createExit) al
// confirmar una entrega: la porción entregada deja de estar reservada
// (porque ya salió de verdad), sin que esta función toque el stock
// físico — eso lo hace `createExit`/`valuation.applyExit`, en la misma
// transacción.
async function fulfillReservation(tx, reservation, quantity) {
  const qty = new Decimal(quantity);
  const remaining = new Decimal(reservation.quantity).minus(reservation.releasedQuantity);
  const toFulfill = Decimal.min(qty, remaining);
  if (toFulfill.isZero()) return reservation;

  await tx.stockLevel.updateMany({
    where: { variantId: reservation.variantId, warehouseId: reservation.warehouseId },
    data: { quantityReserved: { decrement: toFulfill } },
  });

  const newReleased = new Decimal(reservation.releasedQuantity).plus(toFulfill);
  const fullyFulfilled = newReleased.greaterThanOrEqualTo(reservation.quantity);

  return tx.inventoryReservation.update({
    where: { id: reservation.id },
    data: { releasedQuantity: newReleased, status: fullyFulfilled ? 'FULFILLED' : 'PARTIALLY_RELEASED' },
  });
}

async function getReservationForOrderLine(tx, orderLineId) {
  return tx.inventoryReservation.findFirst({ where: { orderLineId }, orderBy: { createdAt: 'desc' } });
}

module.exports = { reserveForOrderLine, releaseReservation, fulfillReservation, getReservationForOrderLine };
