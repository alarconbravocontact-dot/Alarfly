// Fase 2 (maestros): ProductCategory no tenía ningún test, ni la
// posibilidad de editarse o desactivarse (solo crear/listar/ver
// existían). Confirma la nueva auditoría de creación/modificación y el
// nuevo campo `isActive`.
jest.mock('../../../core/database/prisma', () => {
  const productCategory = { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() };
  return { productCategory, $transaction: jest.fn((cb) => cb({ productCategory })) };
});
jest.mock('../../../core/audit/audit.service', () => ({ log: jest.fn() }));

const prisma = require('../../../core/database/prisma');
const auditService = require('../../../core/audit/audit.service');
const categoriesService = require('./product-categories.service');

describe('product-categories.service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('createCategory audita la creación', async () => {
    prisma.productCategory.create.mockResolvedValue({ id: 'cat1', name: 'Electrónica' });

    const result = await categoriesService.createCategory('company-1', { name: 'Electrónica' }, 'user-1');

    expect(result).toEqual({ id: 'cat1', name: 'Electrónica' });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'product_category.created', entityType: 'ProductCategory', entityId: 'cat1' }),
      expect.anything()
    );
  });

  test('updateCategory rechaza una categoría inexistente', async () => {
    prisma.productCategory.findFirst.mockResolvedValue(null);
    await expect(categoriesService.updateCategory('company-1', 'no-existe', { name: 'X' })).rejects.toThrow('La categoría indicada no existe.');
  });

  test('updateCategory desactiva y audita el estado anterior', async () => {
    prisma.productCategory.findFirst.mockResolvedValue({ id: 'cat1', isActive: true });
    prisma.productCategory.update.mockResolvedValue({ id: 'cat1', isActive: false });

    const result = await categoriesService.updateCategory('company-1', 'cat1', { isActive: false }, 'user-1');

    expect(result).toEqual({ id: 'cat1', isActive: false });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'product_category.updated', oldValue: { isActive: true }, newValue: { isActive: false } }),
      expect.anything()
    );
  });
});
