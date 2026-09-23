const prisma = require('../database/prisma');
const AppError = require('../utils/AppError');

// CRUD simple de valores de dimensiones analíticas (centro de costo,
// proyecto, sucursal). Los módulos dueños de cada concepto todavía no
// existen; mientras tanto, cualquier módulo puede crear y usar estos
// valores para etiquetar sus movimientos.

async function create({ companyId, type, code, name }) {
  const existing = await prisma.dimension.findUnique({
    where: { companyId_type_code: { companyId, type, code } },
  });
  if (existing) {
    throw new AppError(`Ya existe una dimensión "${type}" con el código "${code}".`, 409, 'DIMENSION_EXISTS');
  }
  return prisma.dimension.create({ data: { companyId, type, code, name } });
}

async function list(companyId, type) {
  return prisma.dimension.findMany({
    where: { companyId, type: type || undefined, isActive: true },
    orderBy: { code: 'asc' },
  });
}

async function deactivate(companyId, id) {
  const dimension = await prisma.dimension.findFirst({ where: { id, companyId } });
  if (!dimension) {
    throw new AppError('La dimensión indicada no existe.', 404, 'DIMENSION_NOT_FOUND');
  }
  return prisma.dimension.update({ where: { id }, data: { isActive: false } });
}

module.exports = { create, list, deactivate };
