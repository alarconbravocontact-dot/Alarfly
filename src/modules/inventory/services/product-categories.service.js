const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');

async function createCategory(companyId, data, userId = null) {
  return prisma.$transaction(async (tx) => {
    const category = await tx.productCategory.create({
      data: { companyId, name: data.name, defaultValuationMethod: data.defaultValuationMethod || null },
    });
    await auditService.log(
      { companyId, userId, action: 'product_category.created', entityType: 'ProductCategory', entityId: category.id, newValue: { name: category.name } },
      tx
    );
    return category;
  });
}

// Fase 2 (maestros): antes de esto no existía forma de corregir el
// nombre de una categoría ni de retirarla — una vez creada, vivía para
// siempre visible en cada selector de producto. `isActive` (columna
// nueva) sigue el mismo patrón que Product/Customer/Vendor.
async function updateCategory(companyId, id, changes, userId = null) {
  const category = await prisma.productCategory.findFirst({ where: { id, companyId } });
  if (!category) {
    throw new AppError('La categoría indicada no existe.', 404, 'CATEGORY_NOT_FOUND');
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.productCategory.update({ where: { id }, data: changes });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'product_category.updated',
        entityType: 'ProductCategory',
        entityId: id,
        oldValue: changes.isActive !== undefined ? { isActive: category.isActive } : undefined,
        newValue: changes,
      },
      tx
    );
    return updated;
  });
}

async function listCategories(companyId, { isActive } = {}) {
  return prisma.productCategory.findMany({
    where: { companyId, isActive: isActive === undefined ? undefined : isActive },
    orderBy: { name: 'asc' },
  });
}

async function getCategory(companyId, id) {
  const category = await prisma.productCategory.findFirst({ where: { id, companyId } });
  if (!category) {
    throw new AppError('La categoría indicada no existe.', 404, 'CATEGORY_NOT_FOUND');
  }
  return category;
}

module.exports = { createCategory, updateCategory, listCategories, getCategory };
