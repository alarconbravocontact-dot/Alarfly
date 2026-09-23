// Consultas de stock (punto 3): saldo por variante/almacén, stock
// disponible (físico - reservado) y el valor total del inventario en
// cualquier momento, por almacén y consolidado.
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const valuationService = require('./valuation.service');
const { calculateAvailableStock } = require('./valuation.rules');

const { Decimal } = Prisma;

async function getStockLevel(companyId, variantId, warehouseId) {
  const level = await prisma.stockLevel.findFirst({ where: { companyId, variantId, warehouseId } });
  const quantityOnHand = level ? level.quantityOnHand : new Decimal(0);
  const quantityReserved = level ? level.quantityReserved : new Decimal(0);
  return {
    variantId,
    warehouseId,
    quantityOnHand: new Decimal(quantityOnHand).toFixed(4),
    quantityReserved: new Decimal(quantityReserved).toFixed(4),
    quantityAvailable: calculateAvailableStock(quantityOnHand, quantityReserved).toFixed(4),
  };
}

async function listStockLevels(companyId, { warehouseId, variantId } = {}) {
  const levels = await prisma.stockLevel.findMany({
    where: { companyId, warehouseId: warehouseId || undefined, variantId: variantId || undefined },
    include: { variant: { include: { product: true } }, warehouse: true },
  });
  return levels.map((level) => ({
    variantId: level.variantId,
    productName: level.variant.product.name,
    variantSku: level.variant.sku,
    warehouseId: level.warehouseId,
    warehouseName: level.warehouse.name,
    quantityOnHand: new Decimal(level.quantityOnHand).toFixed(4),
    quantityReserved: new Decimal(level.quantityReserved).toFixed(4),
    quantityAvailable: calculateAvailableStock(level.quantityOnHand, level.quantityReserved).toFixed(4),
  }));
}

// Valor total del inventario (punto 3): para PMP usa
// quantityOnHand * averageCost; para FIFO/LIFO usa la suma de lo que
// queda en cada capa de costo (remainingQuantity * unitCost) — nunca
// se guarda un valor duplicado, siempre se calcula desde la misma
// fuente que ya mantiene el motor de valoración.
async function getInventoryValuation(companyId, { warehouseId } = {}) {
  const stockLevels = await prisma.stockLevel.findMany({
    where: { companyId, warehouseId: warehouseId || undefined },
    include: { variant: { include: { product: { include: { category: true } } } }, warehouse: true },
  });

  let totalValue = new Decimal(0);
  const byWarehouse = new Map();
  const rows = [];

  for (const level of stockLevels) {
    const method = await valuationService.resolveValuationMethod(companyId, level.variant.product);
    let value;
    if (method === 'WEIGHTED_AVERAGE') {
      value = new Decimal(level.quantityOnHand).times(level.averageCost);
    } else {
      const layers = await prisma.stockCostLayer.findMany({ where: { variantId: level.variantId, warehouseId: level.warehouseId } });
      value = layers.reduce((sum, l) => sum.plus(new Decimal(l.remainingQuantity).times(l.unitCost)), new Decimal(0));
    }

    totalValue = totalValue.plus(value);
    const entry = byWarehouse.get(level.warehouseId) || {
      warehouseId: level.warehouseId,
      warehouseName: level.warehouse.name,
      value: new Decimal(0),
    };
    entry.value = entry.value.plus(value);
    byWarehouse.set(level.warehouseId, entry);

    rows.push({
      variantId: level.variantId,
      productName: level.variant.product.name,
      variantSku: level.variant.sku,
      warehouseId: level.warehouseId,
      warehouseName: level.warehouse.name,
      quantityOnHand: new Decimal(level.quantityOnHand).toFixed(4),
      value: value.toFixed(2),
    });
  }

  return {
    totalValue: totalValue.toFixed(2),
    byWarehouse: [...byWarehouse.values()].map((w) => ({
      warehouseId: w.warehouseId,
      warehouseName: w.warehouseName,
      value: w.value.toFixed(2),
    })),
    rows,
  };
}

// Punto 7 (Costo real → Rentabilidad): costo unitario vigente de un
// producto en un almacén, para que otros módulos (Reportes) lo
// consulten sin recalcularlo — misma fuente que ya usa
// getInventoryValuation, solo que aquí se expone por unidad.
async function getProductUnitCost(companyId, variantId, warehouseId) {
  const stockLevel = await prisma.stockLevel.findFirst({
    where: { companyId, variantId, warehouseId },
    include: { variant: { include: { product: { include: { category: true } } } } },
  });
  if (!stockLevel) {
    return { variantId, warehouseId, method: null, unitCost: '0.000000' };
  }

  const method = await valuationService.resolveValuationMethod(companyId, stockLevel.variant.product);

  if (method === 'WEIGHTED_AVERAGE') {
    return { variantId, warehouseId, method, unitCost: new Decimal(stockLevel.averageCost).toFixed(6) };
  }

  const layers = await prisma.stockCostLayer.findMany({ where: { variantId, warehouseId, remainingQuantity: { gt: 0 } } });
  const totalQty = layers.reduce((sum, l) => sum.plus(l.remainingQuantity), new Decimal(0));
  const totalValue = layers.reduce((sum, l) => sum.plus(new Decimal(l.remainingQuantity).times(l.unitCost)), new Decimal(0));
  const unitCost = totalQty.isZero() ? new Decimal(0) : totalValue.dividedBy(totalQty);
  return { variantId, warehouseId, method, unitCost: unitCost.toFixed(6) };
}

module.exports = { getStockLevel, listStockLevels, getInventoryValuation, getProductUnitCost };
