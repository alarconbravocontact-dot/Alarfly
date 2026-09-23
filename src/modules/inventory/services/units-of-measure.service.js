const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');

async function createUnitOfMeasure(companyId, data, userId = null) {
  return prisma.$transaction(async (tx) => {
    const unit = await tx.unitOfMeasure.create({ data: { companyId, code: data.code, name: data.name } });
    await auditService.log(
      { companyId, userId, action: 'unit_of_measure.created', entityType: 'UnitOfMeasure', entityId: unit.id, newValue: { code: unit.code, name: unit.name } },
      tx
    );
    return unit;
  });
}

// Fase 2 (maestros): mismo motivo que product-categories.service —
// antes no había forma de corregir ni de retirar una unidad de medida.
async function updateUnitOfMeasure(companyId, id, changes, userId = null) {
  const unit = await prisma.unitOfMeasure.findFirst({ where: { id, companyId } });
  if (!unit) {
    throw new AppError('La unidad de medida indicada no existe.', 404, 'UNIT_OF_MEASURE_NOT_FOUND');
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.unitOfMeasure.update({ where: { id }, data: changes });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'unit_of_measure.updated',
        entityType: 'UnitOfMeasure',
        entityId: id,
        oldValue: changes.isActive !== undefined ? { isActive: unit.isActive } : undefined,
        newValue: changes,
      },
      tx
    );
    return updated;
  });
}

async function listUnitsOfMeasure(companyId, { isActive } = {}) {
  return prisma.unitOfMeasure.findMany({
    where: { companyId, isActive: isActive === undefined ? undefined : isActive },
    orderBy: { name: 'asc' },
  });
}

async function getUnitOfMeasure(companyId, id) {
  const unit = await prisma.unitOfMeasure.findFirst({ where: { id, companyId } });
  if (!unit) {
    throw new AppError('La unidad de medida indicada no existe.', 404, 'UNIT_OF_MEASURE_NOT_FOUND');
  }
  return unit;
}

module.exports = { createUnitOfMeasure, updateUnitOfMeasure, listUnitsOfMeasure, getUnitOfMeasure };
