// Trazabilidad de Lotes (punto 8): dado un lote, en qué entradas llegó
// y en qué salidas se usó. Se reconstruye a partir de datos que ya se
// guardan al operar (InventoryMovement.lotId en la entrada,
// StockCostLayerConsumption en cada salida) — no se recalcula ningún
// consumo FIFO/LIFO de nuevo.
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');

const { Decimal } = Prisma;

async function listLots(companyId, { variantId, expiringBefore } = {}) {
  return prisma.inventoryLot.findMany({
    where: {
      companyId,
      variantId: variantId || undefined,
      expirationDate: expiringBefore ? { lte: expiringBefore } : undefined,
    },
    include: { variant: { include: { product: true } } },
    orderBy: { expirationDate: 'asc' },
  });
}

async function getLotTrace(companyId, lotId) {
  const lot = await prisma.inventoryLot.findFirst({
    where: { id: lotId, companyId },
    include: { variant: { include: { product: true } } },
  });
  if (!lot) {
    throw new AppError('El lote indicado no existe.', 404, 'INVENTORY_LOT_NOT_FOUND');
  }

  const entryMovements = await prisma.inventoryMovement.findMany({
    where: { lotId: lot.id },
    include: {
      warehouse: true,
      costLayersCreated: { include: { consumptions: { include: { exitMovement: true } } } },
    },
    orderBy: { date: 'asc' },
  });

  const entries = entryMovements.map((m) => ({
    movementId: m.id,
    date: m.date,
    quantity: new Decimal(m.quantity).toFixed(4),
    unitCost: new Decimal(m.unitCost).toFixed(6),
    warehouseId: m.warehouseId,
    warehouseName: m.warehouse.name,
  }));

  // Un producto por Promedio Ponderado (PMP) nunca crea StockCostLayer (solo
  // FIFO/LIFO las crea) — para esos productos este lote no tiene ninguna capa
  // de costo ligada, así que no hay forma de saber cuánto de ESTE lote en
  // particular queda (el costo/cantidad de todos los lotes se mezcla en un
  // solo promedio). Reportar "0" en ese caso sería un dato falso (el lote
  // puede seguir teniendo stock real, solo que no rastreado por lote) — se
  // distingue explícitamente de un lote FIFO/LIFO genuinamente agotado
  // (donde sí hay capas, y su suma real es 0).
  const hasCostLayerTracking = entryMovements.some((m) => m.costLayersCreated.length > 0);

  const usages = [];
  let remainingQuantity = new Decimal(0);
  for (const movement of entryMovements) {
    for (const layer of movement.costLayersCreated) {
      remainingQuantity = remainingQuantity.plus(layer.remainingQuantity);
      for (const consumption of layer.consumptions) {
        usages.push({
          exitMovementId: consumption.exitMovementId,
          exitType: consumption.exitMovement.type,
          exitDate: consumption.exitMovement.date,
          warehouseId: consumption.exitMovement.warehouseId,
          quantityConsumed: new Decimal(consumption.quantity).toFixed(4),
          referenceType: consumption.exitMovement.referenceType,
          referenceId: consumption.exitMovement.referenceId,
        });
      }
    }
  }

  return {
    lot: { id: lot.id, lotNumber: lot.lotNumber, isSerialNumber: lot.isSerialNumber, expirationDate: lot.expirationDate },
    variantId: lot.variantId,
    productName: lot.variant.product.name,
    variantSku: lot.variant.sku,
    entries,
    exactTraceAvailable: hasCostLayerTracking,
    remainingQuantity: hasCostLayerTracking ? remainingQuantity.toFixed(4) : null,
    usages,
  };
}

module.exports = { listLots, getLotTrace };
