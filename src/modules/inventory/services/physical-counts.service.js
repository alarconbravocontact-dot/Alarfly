// Conteo Físico (punto 4): quien cuenta registra el conteo real, el
// sistema calcula la diferencia contra lo que dice el sistema, y un
// aprobador DISTINTO decide si genera el ajuste — nunca la misma
// persona que contó.
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const inventoryMovementsService = require('./inventory-movements.service');
const { calculateCountDifference, assertCanApproveCount } = require('./physical-count.rules');

const { Decimal } = Prisma;

async function startCount(companyId, userId, data) {
  const warehouse = await prisma.warehouse.findFirst({ where: { id: data.warehouseId, companyId, isActive: true } });
  if (!warehouse) {
    throw new AppError('El almacén indicado no existe o está inactivo.', 404, 'WAREHOUSE_NOT_FOUND');
  }

  const stockLevels = await prisma.stockLevel.findMany({ where: { companyId, warehouseId: data.warehouseId } });

  return prisma.$transaction(async (tx) => {
    const count = await tx.physicalCount.create({
      data: {
        companyId,
        warehouseId: data.warehouseId,
        countedByUserId: userId,
        lines: {
          create: stockLevels.map((level) => ({
            variantId: level.variantId,
            systemQuantity: level.quantityOnHand,
            countedQuantity: level.quantityOnHand, // se sobreescribe al someter el conteo
          })),
        },
      },
      include: { lines: true },
    });

    await auditService.log(
      {
        companyId,
        userId,
        action: 'physical_count.started',
        entityType: 'PhysicalCount',
        entityId: count.id,
        oldValue: null,
        newValue: count,
      },
      tx
    );

    return count;
  });
}

async function submitCount(companyId, userId, countId, lines) {
  const count = await prisma.physicalCount.findFirst({ where: { id: countId, companyId }, include: { lines: true } });
  if (!count) {
    throw new AppError('El conteo indicado no existe.', 404, 'PHYSICAL_COUNT_NOT_FOUND');
  }
  if (count.status !== 'DRAFT') {
    throw new AppError('Este conteo ya fue sometido.', 409, 'INVALID_COUNT_STATUS');
  }
  if (count.countedByUserId !== userId) {
    throw new AppError('Solo quien inició el conteo puede someterlo a aprobación.', 403, 'NOT_COUNT_OWNER');
  }

  const linesByVariant = new Map(lines.map((l) => [l.variantId, l.countedQuantity]));

  return prisma.$transaction(async (tx) => {
    for (const line of count.lines) {
      if (!linesByVariant.has(line.variantId)) continue;
      await tx.physicalCountLine.update({
        where: { id: line.id },
        data: { countedQuantity: linesByVariant.get(line.variantId) },
      });
    }

    const updated = await tx.physicalCount.update({
      where: { id: countId },
      data: { status: 'PENDING_APPROVAL', countedAt: new Date() },
      include: { lines: true },
    });

    await auditService.log(
      {
        companyId,
        userId,
        action: 'physical_count.submitted',
        entityType: 'PhysicalCount',
        entityId: countId,
        oldValue: count,
        newValue: updated,
      },
      tx
    );

    return updated;
  });
}

async function approveCount(companyId, userId, countId) {
  const count = await prisma.physicalCount.findFirst({ where: { id: countId, companyId }, include: { lines: true } });
  if (!count) {
    throw new AppError('El conteo indicado no existe.', 404, 'PHYSICAL_COUNT_NOT_FOUND');
  }
  assertCanApproveCount(count, userId);

  const today = new Date();

  for (const line of count.lines) {
    const difference = calculateCountDifference(line.systemQuantity, line.countedQuantity);
    if (difference.isZero()) continue;

    const movement = await inventoryMovementsService.createAdjustment(companyId, userId, {
      variantId: line.variantId,
      warehouseId: count.warehouseId,
      direction: difference.isPositive() ? 'INCREASE' : 'DECREASE',
      quantity: difference.abs(),
      unitCost: difference.isPositive() ? await resolveIncreaseCost(companyId, count.warehouseId, line.variantId) : undefined,
      reason: `Ajuste por conteo físico #${count.id}`,
      date: today,
    });

    await prisma.physicalCountLine.update({ where: { id: line.id }, data: { adjustmentMovementId: movement.id } });
  }

  const updated = await prisma.physicalCount.update({
    where: { id: countId },
    data: { status: 'APPROVED', approvedByUserId: userId, approvedAt: today },
    include: { lines: true },
  });

  await auditService.log({
    companyId,
    userId,
    action: 'physical_count.approved',
    entityType: 'PhysicalCount',
    entityId: countId,
    oldValue: count,
    newValue: updated,
  });

  return updated;
}

// Un sobrante encontrado en el conteo se valora al costo promedio
// vigente del almacén (o al costo de la capa más reciente en
// FIFO/LIFO) — es la mejor estimación disponible sin un precio de
// compra real para ese sobrante.
async function resolveIncreaseCost(companyId, warehouseId, variantId) {
  const stockLevel = await prisma.stockLevel.findUnique({ where: { variantId_warehouseId: { variantId, warehouseId } } });
  if (stockLevel && new Decimal(stockLevel.averageCost).greaterThan(0)) {
    return stockLevel.averageCost;
  }
  const lastLayer = await prisma.stockCostLayer.findFirst({
    where: { variantId, warehouseId },
    orderBy: { entryDate: 'desc' },
  });
  return lastLayer ? lastLayer.unitCost : new Decimal(0);
}

async function rejectCount(companyId, userId, countId, rejectionReason) {
  const count = await prisma.physicalCount.findFirst({ where: { id: countId, companyId } });
  if (!count) {
    throw new AppError('El conteo indicado no existe.', 404, 'PHYSICAL_COUNT_NOT_FOUND');
  }
  assertCanApproveCount(count, userId);
  if (!rejectionReason) {
    throw new AppError('Debes indicar el motivo del rechazo.', 400, 'REJECTION_REASON_REQUIRED');
  }

  const updated = await prisma.physicalCount.update({
    where: { id: countId },
    data: { status: 'REJECTED', approvedByUserId: userId, approvedAt: new Date(), rejectionReason },
  });

  await auditService.log({
    companyId,
    userId,
    action: 'physical_count.rejected',
    entityType: 'PhysicalCount',
    entityId: countId,
    oldValue: count,
    newValue: updated,
  });

  return updated;
}

async function getCount(companyId, id) {
  const count = await prisma.physicalCount.findFirst({
    where: { id, companyId },
    include: { lines: true, warehouse: true, countedByUser: true, approvedByUser: true },
  });
  if (!count) {
    throw new AppError('El conteo indicado no existe.', 404, 'PHYSICAL_COUNT_NOT_FOUND');
  }
  return count;
}

async function listCounts(companyId, { warehouseId, status } = {}) {
  return prisma.physicalCount.findMany({
    where: { companyId, warehouseId: warehouseId || undefined, status: status || undefined },
    include: { warehouse: true },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = { startCount, submitCount, approveCount, rejectCount, getCount, listCounts };
