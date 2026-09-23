// Catálogo Maestro de Productos y Variantes (punto 1). Todo producto
// tiene al menos una variante — si no maneja variantes reales (talla,
// color...), se le crea una variante "default" automáticamente, para
// que el stock/costo/movimientos siempre se manejen sobre
// ProductVariant sin dos caminos de código distintos.
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');

async function assertAccountUsable(companyId, accountId) {
  if (!accountId) return;
  const account = await prisma.account.findFirst({ where: { id: accountId, companyId } });
  if (!account) {
    throw new AppError('La cuenta contable indicada no existe en esta empresa.', 400, 'ACCOUNT_NOT_FOUND');
  }
}

async function assertVendorUsable(companyId, vendorId) {
  if (!vendorId) return;
  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, companyId } });
  if (!vendor) {
    throw new AppError('El proveedor indicado no existe en esta empresa.', 400, 'VENDOR_NOT_FOUND');
  }
}

async function createProduct(companyId, data) {
  const baseUnit = await prisma.unitOfMeasure.findFirst({ where: { id: data.baseUnitOfMeasureId, companyId } });
  if (!baseUnit) {
    throw new AppError('La unidad de medida base indicada no existe en esta empresa.', 400, 'UNIT_OF_MEASURE_NOT_FOUND');
  }
  if (data.categoryId) {
    const category = await prisma.productCategory.findFirst({ where: { id: data.categoryId, companyId } });
    if (!category) {
      throw new AppError('La categoría indicada no existe en esta empresa.', 400, 'CATEGORY_NOT_FOUND');
    }
  }
  await assertAccountUsable(companyId, data.inventoryAssetAccountId);
  await assertAccountUsable(companyId, data.cogsExpenseAccountId);
  await assertVendorUsable(companyId, data.preferredVendorId);

  const variants =
    Array.isArray(data.variants) && data.variants.length > 0
      ? data.variants.map((v) => ({ sku: v.sku, attributes: v.attributes || null }))
      : [{ sku: data.sku, attributes: null }];

  const unitConversions = Array.isArray(data.unitConversions)
    ? data.unitConversions.map((c) => ({ unitOfMeasureId: c.unitOfMeasureId, conversionFactor: c.conversionFactor }))
    : [];

  return prisma.product.create({
    data: {
      companyId,
      sku: data.sku,
      name: data.name,
      description: data.description || null,
      categoryId: data.categoryId || null,
      valuationMethod: data.valuationMethod || null,
      baseUnitOfMeasureId: data.baseUnitOfMeasureId,
      inventoryAssetAccountId: data.inventoryAssetAccountId || null,
      cogsExpenseAccountId: data.cogsExpenseAccountId || null,
      isService: data.isService ?? false,
      trackLots: data.trackLots ?? false,
      trackExpiration: data.trackExpiration ?? false,
      minStock: data.minStock ?? null,
      maxStock: data.maxStock ?? null,
      preferredVendorId: data.preferredVendorId || null,
      variants: { create: variants },
      unitConversions: { create: unitConversions },
    },
    include: { variants: true, unitConversions: true },
  });
}

async function updateProduct(companyId, id, changes) {
  const product = await prisma.product.findFirst({ where: { id, companyId } });
  if (!product) {
    throw new AppError('El producto indicado no existe.', 404, 'PRODUCT_NOT_FOUND');
  }
  await assertAccountUsable(companyId, changes.inventoryAssetAccountId);
  await assertAccountUsable(companyId, changes.cogsExpenseAccountId);
  await assertVendorUsable(companyId, changes.preferredVendorId);
  return prisma.product.update({ where: { id }, data: changes });
}

async function addVariant(companyId, productId, data) {
  const product = await prisma.product.findFirst({ where: { id: productId, companyId } });
  if (!product) {
    throw new AppError('El producto indicado no existe.', 404, 'PRODUCT_NOT_FOUND');
  }
  return prisma.productVariant.create({ data: { productId, sku: data.sku, attributes: data.attributes || null } });
}

async function listProducts(companyId, { isActive, categoryId } = {}) {
  return prisma.product.findMany({
    where: { companyId, isActive: isActive === undefined ? undefined : isActive, categoryId: categoryId || undefined },
    include: { variants: true, category: true, baseUnitOfMeasure: true },
    orderBy: { name: 'asc' },
  });
}

async function getProduct(companyId, id) {
  const product = await prisma.product.findFirst({
    where: { id, companyId },
    include: { variants: true, category: true, baseUnitOfMeasure: true, unitConversions: { include: { unitOfMeasure: true } } },
  });
  if (!product) {
    throw new AppError('El producto indicado no existe.', 404, 'PRODUCT_NOT_FOUND');
  }
  return product;
}

async function getVariant(companyId, variantId) {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, product: { companyId } },
    include: { product: { include: { category: true } }, bomAsParent: { include: { components: true } } },
  });
  if (!variant) {
    throw new AppError('La variante de producto indicada no existe.', 404, 'PRODUCT_VARIANT_NOT_FOUND');
  }
  return variant;
}

module.exports = { createProduct, updateProduct, addVariant, listProducts, getProduct, getVariant };
