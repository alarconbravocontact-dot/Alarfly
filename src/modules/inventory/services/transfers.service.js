// Transferencias entre almacenes (punto 2). El inventario TOTAL de la
// empresa no cambia (solo de almacén), así que una transferencia NO
// genera asiento contable — a diferencia de entradas/salidas/ajustes,
// que sí afectan el valor. El costo de la mercancía viaja con ella: la
// capa/costo que se crea en el almacén destino usa el mismo costo
// unitario que se consumió en el almacén origen.
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const valuationService = require('./valuation.service');

const { Decimal } = Prisma;

async function createTransfer(companyId, userId, data) {
  if (data.fromWarehouseId === data.toWarehouseId) {
    throw new AppError('El almacén de origen y destino no pueden ser el mismo.', 400, 'SAME_WAREHOUSE_TRANSFER');
  }
  const [fromWarehouse, toWarehouse] = await Promise.all([
    prisma.warehouse.findFirst({ where: { id: data.fromWarehouseId, companyId, isActive: true } }),
    prisma.warehouse.findFirst({ where: { id: data.toWarehouseId, companyId, isActive: true } }),
  ]);
  if (!fromWarehouse || !toWarehouse) {
    throw new AppError('Alguno de los almacenes indicados no existe o está inactivo.', 404, 'WAREHOUSE_NOT_FOUND');
  }
  if (!Array.isArray(data.lines) || data.lines.length === 0) {
    throw new AppError('La transferencia necesita al menos una línea.', 400, 'TRANSFER_LINES_REQUIRED');
  }

  // Se calcula el costo de salida de cada línea ANTES de escribir nada
  // (igual criterio que entradas/salidas: leer primero, mutar después).
  const linesWithCost = [];
  for (const line of data.lines) {
    const variant = await prisma.productVariant.findFirst({
      where: { id: line.variantId, product: { companyId } },
      include: { product: { include: { category: true } } },
    });
    if (!variant) {
      throw new AppError('Una de las variantes indicadas no existe.', 404, 'PRODUCT_VARIANT_NOT_FOUND');
    }
    const method = await valuationService.resolveValuationMethod(companyId, variant.product);
    const qty = new Decimal(line.quantity);
    const { unitCost, layerConsumptions } = await valuationService.computeExitCost(
      companyId,
      line.variantId,
      data.fromWarehouseId,
      qty,
      method
    );
    linesWithCost.push({ variant, quantity: qty, unitCost, method, layerConsumptions });
  }

  return prisma.$transaction(async (tx) => {
    const transfer = await tx.inventoryTransfer.create({
      data: {
        companyId,
        fromWarehouseId: data.fromWarehouseId,
        toWarehouseId: data.toWarehouseId,
        date: data.date,
        createdByUserId: userId,
      },
    });

    for (const line of linesWithCost) {
      const outMovement = await tx.inventoryMovement.create({
        data: {
          companyId,
          variantId: line.variant.id,
          warehouseId: data.fromWarehouseId,
          type: 'TRANSFER_OUT',
          quantity: line.quantity,
          unitCost: line.unitCost,
          totalCost: line.unitCost.times(line.quantity).toDecimalPlaces(2),
          date: data.date,
          referenceType: 'InventoryTransfer',
          referenceId: transfer.id,
          createdByUserId: userId,
        },
      });

      await valuationService.applyExit(tx, {
        companyId,
        variantId: line.variant.id,
        warehouseId: data.fromWarehouseId,
        quantity: line.quantity,
        method: line.method,
        layerConsumptions: line.layerConsumptions,
        movementId: outMovement.id,
      });

      const inMovement = await tx.inventoryMovement.create({
        data: {
          companyId,
          variantId: line.variant.id,
          warehouseId: data.toWarehouseId,
          type: 'TRANSFER_IN',
          quantity: line.quantity,
          unitCost: line.unitCost,
          totalCost: line.unitCost.times(line.quantity).toDecimalPlaces(2),
          date: data.date,
          referenceType: 'InventoryTransfer',
          referenceId: transfer.id,
          createdByUserId: userId,
        },
      });

      await valuationService.applyEntry(tx, {
        companyId,
        variantId: line.variant.id,
        warehouseId: data.toWarehouseId,
        quantity: line.quantity,
        unitCost: line.unitCost,
        movementId: inMovement.id,
        date: data.date,
        method: line.method,
      });

      await tx.inventoryTransferLine.create({
        data: {
          transferId: transfer.id,
          variantId: line.variant.id,
          quantity: line.quantity,
          outMovementId: outMovement.id,
          inMovementId: inMovement.id,
        },
      });
    }

    await auditService.log(
      {
        companyId,
        userId,
        action: 'inventory_transfer.created',
        entityType: 'InventoryTransfer',
        entityId: transfer.id,
        oldValue: null,
        newValue: transfer,
      },
      tx
    );

    return tx.inventoryTransfer.findUnique({ where: { id: transfer.id }, include: { lines: true } });
  });
}

async function getTransfer(companyId, id) {
  const transfer = await prisma.inventoryTransfer.findFirst({
    where: { id, companyId },
    include: { lines: true, fromWarehouse: true, toWarehouse: true },
  });
  if (!transfer) {
    throw new AppError('La transferencia indicada no existe.', 404, 'TRANSFER_NOT_FOUND');
  }
  return transfer;
}

async function listTransfers(companyId) {
  return prisma.inventoryTransfer.findMany({
    where: { companyId },
    include: { fromWarehouse: true, toWarehouse: true },
    orderBy: { date: 'desc' },
  });
}

module.exports = { createTransfer, getTransfer, listTransfers };
