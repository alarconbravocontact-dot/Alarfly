const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');

async function createCategory(companyId, data) {
  return prisma.productCategory.create({
    data: { companyId, name: data.name, defaultValuationMethod: data.defaultValuationMethod || null },
  });
}

async function listCategories(companyId) {
  return prisma.productCategory.findMany({ where: { companyId }, orderBy: { name: 'asc' } });
}

async function getCategory(companyId, id) {
  const category = await prisma.productCategory.findFirst({ where: { id, companyId } });
  if (!category) {
    throw new AppError('La categoría indicada no existe.', 404, 'CATEGORY_NOT_FOUND');
  }
  return category;
}

module.exports = { createCategory, listCategories, getCategory };
