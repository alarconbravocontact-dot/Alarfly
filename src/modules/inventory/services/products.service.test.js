// Fase 2 (maestros): products.service.js no tenía ningún test unitario
// (solo estaba cubierto indirectamente por flujos de integración de
// Inventario). Antes de esta fase, crear/modificar un producto no dejaba
// ningún rastro auditable.
jest.mock('../../../core/database/prisma', () => {
  const product = { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() };
  const productVariant = { create: jest.fn() };
  return {
    product,
    productVariant,
    unitOfMeasure: { findFirst: jest.fn() },
    productCategory: { findFirst: jest.fn() },
    account: { findFirst: jest.fn() },
    vendor: { findFirst: jest.fn() },
    $transaction: jest.fn((cb) => cb({ product, productVariant })),
  };
});
jest.mock('../../../core/audit/audit.service', () => ({ log: jest.fn() }));

const prisma = require('../../../core/database/prisma');
const auditService = require('../../../core/audit/audit.service');
const productsService = require('./products.service');

describe('products.service.createProduct', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rechaza si la unidad de medida base no existe en la empresa', async () => {
    prisma.unitOfMeasure.findFirst.mockResolvedValue(null);
    await expect(
      productsService.createProduct('company-1', { sku: 'SKU1', name: 'Producto 1', baseUnitOfMeasureId: 'u-fantasma' })
    ).rejects.toThrow('La unidad de medida base indicada no existe en esta empresa.');
    expect(prisma.product.create).not.toHaveBeenCalled();
  });

  test('crea el producto (con variante por defecto) y audita la creación', async () => {
    prisma.unitOfMeasure.findFirst.mockResolvedValue({ id: 'u1' });
    prisma.product.create.mockResolvedValue({ id: 'p1', sku: 'SKU1', name: 'Producto 1' });

    const result = await productsService.createProduct(
      'company-1',
      { sku: 'SKU1', name: 'Producto 1', baseUnitOfMeasureId: 'u1' },
      'user-1'
    );

    expect(result).toEqual({ id: 'p1', sku: 'SKU1', name: 'Producto 1' });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'company-1', userId: 'user-1', action: 'product.created', entityType: 'Product', entityId: 'p1' }),
      expect.anything()
    );
  });
});

describe('products.service.updateProduct', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rechaza un producto inexistente', async () => {
    prisma.product.findFirst.mockResolvedValue(null);
    await expect(productsService.updateProduct('company-1', 'no-existe', { name: 'X' })).rejects.toThrow('El producto indicado no existe.');
  });

  test('audita la desactivación con el estado anterior', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: 'p1', isActive: true });
    prisma.product.update.mockResolvedValue({ id: 'p1', isActive: false });

    const result = await productsService.updateProduct('company-1', 'p1', { isActive: false }, 'user-1');

    expect(result).toEqual({ id: 'p1', isActive: false });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'product.updated', entityType: 'Product', entityId: 'p1', oldValue: { isActive: true }, newValue: { isActive: false } }),
      expect.anything()
    );
  });
});

describe('products.service.addVariant', () => {
  beforeEach(() => jest.clearAllMocks());

  test('audita la variante nueva', async () => {
    prisma.product.findFirst.mockResolvedValue({ id: 'p1' });
    prisma.productVariant.create.mockResolvedValue({ id: 'var1', sku: 'SKU1-ROJO' });

    const result = await productsService.addVariant('company-1', 'p1', { sku: 'SKU1-ROJO' }, 'user-1');

    expect(result).toEqual({ id: 'var1', sku: 'SKU1-ROJO' });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'product.variant_added', entityType: 'Product', entityId: 'p1', newValue: { sku: 'SKU1-ROJO' } }),
      expect.anything()
    );
  });
});
