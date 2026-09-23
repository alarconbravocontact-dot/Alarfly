const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');

async function createBom(companyId, data) {
  const parentVariant = await prisma.productVariant.findFirst({ where: { id: data.parentVariantId, product: { companyId } } });
  if (!parentVariant) {
    throw new AppError('La variante padre indicada no existe.', 404, 'PRODUCT_VARIANT_NOT_FOUND');
  }
  if (!Array.isArray(data.components) || data.components.length === 0) {
    throw new AppError('La lista de materiales necesita al menos un componente.', 400, 'BOM_COMPONENTS_REQUIRED');
  }

  for (const component of data.components) {
    if (component.componentVariantId === data.parentVariantId) {
      throw new AppError('Un producto no puede ser componente de sí mismo.', 400, 'BOM_SELF_REFERENCE');
    }
    const variant = await prisma.productVariant.findFirst({ where: { id: component.componentVariantId, product: { companyId } } });
    if (!variant) {
      throw new AppError('Uno de los componentes indicados no existe.', 404, 'PRODUCT_VARIANT_NOT_FOUND');
    }
  }

  return prisma.billOfMaterial.create({
    data: {
      companyId,
      parentVariantId: data.parentVariantId,
      components: {
        create: data.components.map((c) => ({ componentVariantId: c.componentVariantId, quantity: c.quantity })),
      },
    },
    include: { components: true },
  });
}

async function getBom(companyId, parentVariantId) {
  const bom = await prisma.billOfMaterial.findFirst({
    where: { parentVariantId, companyId },
    include: { components: { include: { componentVariant: { include: { product: true } } } } },
  });
  if (!bom) {
    throw new AppError('Esta variante no tiene una lista de materiales.', 404, 'BOM_NOT_FOUND');
  }
  return bom;
}

async function deactivateBom(companyId, parentVariantId) {
  const bom = await prisma.billOfMaterial.findFirst({ where: { parentVariantId, companyId } });
  if (!bom) {
    throw new AppError('Esta variante no tiene una lista de materiales.', 404, 'BOM_NOT_FOUND');
  }
  return prisma.billOfMaterial.update({ where: { id: bom.id }, data: { isActive: false } });
}

module.exports = { createBom, getBom, deactivateBom };
