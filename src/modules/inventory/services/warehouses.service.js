const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');

async function createWarehouse(companyId, data) {
  if (data.branchDimensionId) {
    const dimension = await prisma.dimension.findFirst({
      where: { id: data.branchDimensionId, companyId, type: 'BRANCH' },
    });
    if (!dimension) {
      throw new AppError('La sucursal (dimensión tipo BRANCH) indicada no existe en esta empresa.', 400, 'DIMENSION_NOT_FOUND');
    }
  }
  return prisma.warehouse.create({
    data: {
      companyId,
      code: data.code,
      name: data.name,
      address: data.address || null,
      branchDimensionId: data.branchDimensionId || null,
      isDefault: data.isDefault ?? false,
    },
  });
}

async function updateWarehouse(companyId, id, changes) {
  const warehouse = await prisma.warehouse.findFirst({ where: { id, companyId } });
  if (!warehouse) {
    throw new AppError('El almacén indicado no existe.', 404, 'WAREHOUSE_NOT_FOUND');
  }
  return prisma.warehouse.update({ where: { id }, data: changes });
}

async function listWarehouses(companyId, { isActive } = {}) {
  return prisma.warehouse.findMany({
    where: { companyId, isActive: isActive === undefined ? undefined : isActive },
    orderBy: { name: 'asc' },
  });
}

async function getWarehouse(companyId, id) {
  const warehouse = await prisma.warehouse.findFirst({ where: { id, companyId } });
  if (!warehouse) {
    throw new AppError('El almacén indicado no existe.', 404, 'WAREHOUSE_NOT_FOUND');
  }
  return warehouse;
}

module.exports = { createWarehouse, updateWarehouse, listWarehouses, getWarehouse };
