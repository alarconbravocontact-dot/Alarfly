jest.mock('../database/prisma', () => ({
  pinnedItem: { findMany: jest.fn(), upsert: jest.fn(), findFirst: jest.fn(), delete: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
}));

const prisma = require('../database/prisma');
const AppError = require('../utils/AppError');
const pinnedItemsService = require('./pinned-items.service');

describe('pinned-items.service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('listPinnedItems arma la lista y la devuelve ranqueada', async () => {
    prisma.pinnedItem.findMany.mockResolvedValue([
      { id: 'a', pinnedAt: new Date(), visitCount: 0, lastVisitedAt: null },
    ]);
    const result = await pinnedItemsService.listPinnedItems('c1', 'u1');
    expect(prisma.pinnedItem.findMany).toHaveBeenCalledWith({ where: { companyId: 'c1', userId: 'u1' } });
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty('frequencyScore');
    expect(result[0]).toHaveProperty('suggestUnpin');
  });

  test('pinItem hace upsert por [userId, path]', async () => {
    prisma.pinnedItem.upsert.mockResolvedValue({ id: 'p1', path: '/reportes/flujo-de-efectivo', label: 'Flujo de Efectivo' });
    const result = await pinnedItemsService.pinItem('c1', 'u1', { path: '/reportes/flujo-de-efectivo', label: 'Flujo de Efectivo' });
    expect(prisma.pinnedItem.upsert).toHaveBeenCalledWith({
      where: { userId_path: { userId: 'u1', path: '/reportes/flujo-de-efectivo' } },
      update: { label: 'Flujo de Efectivo' },
      create: { companyId: 'c1', userId: 'u1', path: '/reportes/flujo-de-efectivo', label: 'Flujo de Efectivo' },
    });
    expect(result.id).toBe('p1');
  });

  test('unpinItem rechaza si el ítem no existe o no es del usuario/empresa', async () => {
    prisma.pinnedItem.findFirst.mockResolvedValue(null);
    await expect(pinnedItemsService.unpinItem('c1', 'u1', 'nope')).rejects.toThrow(AppError);
    expect(prisma.pinnedItem.delete).not.toHaveBeenCalled();
  });

  test('unpinItem borra cuando el ítem sí es del usuario', async () => {
    prisma.pinnedItem.findFirst.mockResolvedValue({ id: 'p1' });
    await pinnedItemsService.unpinItem('c1', 'u1', 'p1');
    expect(prisma.pinnedItem.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });

  test('recordVisit no hace nada si la ruta no está anclada (silencioso, no es un error)', async () => {
    prisma.pinnedItem.findUnique.mockResolvedValue(null);
    const result = await pinnedItemsService.recordVisit('c1', 'u1', '/no-anclado');
    expect(result).toBeNull();
    expect(prisma.pinnedItem.update).not.toHaveBeenCalled();
  });

  test('recordVisit incrementa visitCount y actualiza lastVisitedAt cuando sí está anclada', async () => {
    prisma.pinnedItem.findUnique.mockResolvedValue({ id: 'p1', companyId: 'c1' });
    prisma.pinnedItem.update.mockResolvedValue({ id: 'p1', visitCount: 2 });
    const result = await pinnedItemsService.recordVisit('c1', 'u1', '/reportes/flujo-de-efectivo');
    expect(prisma.pinnedItem.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { visitCount: { increment: 1 }, lastVisitedAt: expect.any(Date) },
    });
    expect(result.visitCount).toBe(2);
  });

  test('recordVisit no actualiza si el ítem anclado es de otra empresa (aislamiento)', async () => {
    prisma.pinnedItem.findUnique.mockResolvedValue({ id: 'p1', companyId: 'otra-empresa' });
    const result = await pinnedItemsService.recordVisit('c1', 'u1', '/reportes/flujo-de-efectivo');
    expect(result).toBeNull();
    expect(prisma.pinnedItem.update).not.toHaveBeenCalled();
  });
});
