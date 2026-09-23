const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');

async function createUnitOfMeasure(companyId, data) {
  return prisma.unitOfMeasure.create({ data: { companyId, code: data.code, name: data.name } });
}

async function listUnitsOfMeasure(companyId) {
  return prisma.unitOfMeasure.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
}

async function getUnitOfMeasure(companyId, id) {
  const unit = await prisma.unitOfMeasure.findFirst({ where: { id, companyId } });
  if (!unit) {
    throw new AppError('La unidad de medida indicada no existe.', 404, 'UNIT_OF_MEASURE_NOT_FOUND');
  }
  return unit;
}

module.exports = { createUnitOfMeasure, listUnitsOfMeasure, getUnitOfMeasure };
