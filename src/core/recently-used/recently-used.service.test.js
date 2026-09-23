jest.mock('../database/prisma', () => ({
  recentlyUsedEntity: { upsert: jest.fn(), findMany: jest.fn() },
}));

const prisma = require('../database/prisma');
const recentlyUsedService = require('./recently-used.service');

describe('recently-used.service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('recordUsage hace upsert por [userId, entityType, entityId], incrementa useCount si ya existía', async () => {
    prisma.recentlyUsedEntity.upsert.mockResolvedValue({});
    await recentlyUsedService.recordUsage('c1', 'u1', 'account', 'a1');
    expect(prisma.recentlyUsedEntity.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_entityType_entityId: { userId: 'u1', entityType: 'account', entityId: 'a1' } },
        update: expect.objectContaining({ useCount: { increment: 1 } }),
        create: { companyId: 'c1', userId: 'u1', entityType: 'account', entityId: 'a1' },
      })
    );
  });

  test('listRecent filtra por usuario y tipo de entidad, ordenado por uso más reciente primero', async () => {
    prisma.recentlyUsedEntity.findMany.mockResolvedValue([
      { entityId: 'c2', lastUsedAt: new Date('2026-07-19') },
      { entityId: 'c1', lastUsedAt: new Date('2026-07-18') },
    ]);
    const result = await recentlyUsedService.listRecent('u1', 'customer');
    expect(prisma.recentlyUsedEntity.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1', entityType: 'customer' },
      orderBy: { lastUsedAt: 'desc' },
      take: 10,
    });
    expect(result).toEqual(['c2', 'c1']);
  });

  test('listRecent respeta un límite personalizado', async () => {
    prisma.recentlyUsedEntity.findMany.mockResolvedValue([]);
    await recentlyUsedService.listRecent('u1', 'product', 5);
    expect(prisma.recentlyUsedEntity.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
  });
});
