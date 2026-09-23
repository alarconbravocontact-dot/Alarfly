// Motor de Valoración de Stock (punto 3): resuelve el método
// (FIFO/LIFO/PMP) por producto o categoría, aplica entradas (crea capa
// de costo o recalcula el promedio ponderado) y calcula/aplica salidas
// (consume capas o usa el promedio vigente). Las funciones "compute*"
// son de solo lectura (para poder calcular el costo ANTES de postear
// el asiento contable, como ya hacen AR/AP); las "apply*" mutan dentro
// de la transacción del llamador.
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const inventorySettingsService = require('./inventory-settings.service');
const { consumeCostLayers, calculateWeightedAverageCost } = require('./valuation.rules');

const { Decimal } = Prisma;

async function resolveValuationMethod(companyId, product) {
  if (product.valuationMethod) return product.valuationMethod;
  if (product.category?.defaultValuationMethod) return product.category.defaultValuationMethod;
  const settings = await inventorySettingsService.getOrCreateSettings(companyId);
  return settings.defaultValuationMethod;
}

async function resolveInventoryAssetAccount(companyId, product) {
  if (product.inventoryAssetAccountId) return product.inventoryAssetAccountId;
  const settings = await inventorySettingsService.getOrCreateSettings(companyId);
  if (!settings.defaultInventoryAssetAccountId) {
    throw new AppError(
      'Este producto no tiene cuenta de inventario y tampoco hay una configurada por defecto en Ajustes de Inventario.',
      400,
      'INVENTORY_ASSET_ACCOUNT_NOT_CONFIGURED'
    );
  }
  return settings.defaultInventoryAssetAccountId;
}

async function resolveCogsExpenseAccount(companyId, product) {
  if (product.cogsExpenseAccountId) return product.cogsExpenseAccountId;
  const settings = await inventorySettingsService.getOrCreateSettings(companyId);
  if (!settings.defaultCogsExpenseAccountId) {
    throw new AppError(
      'Este producto no tiene cuenta de costo de venta y tampoco hay una configurada por defecto en Ajustes de Inventario.',
      400,
      'COGS_ACCOUNT_NOT_CONFIGURED'
    );
  }
  return settings.defaultCogsExpenseAccountId;
}

async function getOrCreateStockLevel(tx, companyId, variantId, warehouseId) {
  return tx.stockLevel.upsert({
    where: { variantId_warehouseId: { variantId, warehouseId } },
    update: {},
    create: { companyId, variantId, warehouseId },
  });
}

// Aplica una ENTRADA: crea la capa de costo (FIFO/LIFO) o recalcula el
// promedio ponderado (PMP), y sube quantityOnHand. Debe correr dentro
// de la transacción del llamador (ya tiene el movimiento creado).
async function applyEntry(tx, { companyId, variantId, warehouseId, quantity, unitCost, movementId, date, method }) {
  const stockLevel = await getOrCreateStockLevel(tx, companyId, variantId, warehouseId);
  const qty = new Decimal(quantity);
  const cost = new Decimal(unitCost);

  if (method === 'WEIGHTED_AVERAGE') {
    const newAverage = calculateWeightedAverageCost(stockLevel.quantityOnHand, stockLevel.averageCost, qty, cost);
    await tx.stockLevel.update({
      where: { id: stockLevel.id },
      data: { quantityOnHand: { increment: qty }, averageCost: newAverage },
    });
  } else {
    await tx.stockCostLayer.create({
      data: {
        companyId,
        variantId,
        warehouseId,
        entryMovementId: movementId,
        entryDate: date,
        unitCost: cost,
        originalQuantity: qty,
        remainingQuantity: qty,
      },
    });
    await tx.stockLevel.update({ where: { id: stockLevel.id }, data: { quantityOnHand: { increment: qty } } });
  }
}

// Calcula (SIN mutar nada) el costo de una salida — necesario ANTES de
// postear el asiento contable, porque el asiento necesita el monto ya
// resuelto.
async function computeExitCost(companyId, variantId, warehouseId, quantity, method) {
  const qty = new Decimal(quantity);

  if (method === 'WEIGHTED_AVERAGE') {
    const stockLevel = await prisma.stockLevel.findUnique({ where: { variantId_warehouseId: { variantId, warehouseId } } });
    const onHand = stockLevel ? new Decimal(stockLevel.quantityOnHand) : new Decimal(0);
    if (qty.greaterThan(onHand)) {
      throw new AppError(
        `No hay suficiente stock disponible (hay ${onHand.toFixed(4)}, se pidieron ${qty.toFixed(4)}).`,
        400,
        'INSUFFICIENT_STOCK'
      );
    }
    const unitCost = stockLevel ? new Decimal(stockLevel.averageCost) : new Decimal(0);
    return { unitCost, totalCost: unitCost.times(qty), layerConsumptions: null };
  }

  const layers = await prisma.stockCostLayer.findMany({
    where: { variantId, warehouseId, remainingQuantity: { gt: 0 } },
  });
  const { consumptions, totalCost, averageUnitCost } = consumeCostLayers(layers, qty, method);
  return { unitCost: averageUnitCost, totalCost, layerConsumptions: consumptions };
}

// Aplica (mutando) el resultado de computeExitCost — reduce capas o
// solo baja quantityOnHand para PMP. Corre dentro de la transacción
// del llamador. Cuando hay capas (FIFO/LIFO) y se indica `movementId`
// y `companyId`, deja un registro de trazabilidad (punto 8: qué salida
// consumió cuánto de cada capa/lote) — si no se indican, simplemente
// no se deja rastro (ej. algún llamador viejo que no lo necesite).
async function applyExit(tx, { companyId, variantId, warehouseId, quantity, method, layerConsumptions, movementId }) {
  const qty = new Decimal(quantity);

  if (method === 'WEIGHTED_AVERAGE') {
    await tx.stockLevel.update({
      where: { variantId_warehouseId: { variantId, warehouseId } },
      data: { quantityOnHand: { decrement: qty } },
    });
    return;
  }

  for (const consumption of layerConsumptions) {
    await tx.stockCostLayer.update({
      where: { id: consumption.layerId },
      data: { remainingQuantity: { decrement: consumption.quantity } },
    });
    if (companyId && movementId) {
      await tx.stockCostLayerConsumption.create({
        data: { companyId, layerId: consumption.layerId, exitMovementId: movementId, quantity: consumption.quantity },
      });
    }
  }
  await tx.stockLevel.update({
    where: { variantId_warehouseId: { variantId, warehouseId } },
    data: { quantityOnHand: { decrement: qty } },
  });
}

module.exports = {
  resolveValuationMethod,
  resolveInventoryAssetAccount,
  resolveCogsExpenseAccount,
  getOrCreateStockLevel,
  applyEntry,
  computeExitCost,
  applyExit,
};
