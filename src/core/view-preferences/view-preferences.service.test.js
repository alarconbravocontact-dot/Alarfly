jest.mock('../database/prisma', () => ({
  viewModePreference: { findUnique: jest.fn(), upsert: jest.fn() },
}));

const prisma = require('../database/prisma');
const viewPreferencesService = require('./view-preferences.service');

describe('view-preferences.service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getPreference devuelve mode=LIST por defecto si nunca se guardó nada', async () => {
    prisma.viewModePreference.findUnique.mockResolvedValue(null);
    const result = await viewPreferencesService.getPreference('u1', 'treasury-payment-orders');
    expect(prisma.viewModePreference.findUnique).toHaveBeenCalledWith({
      where: { userId_viewKey: { userId: 'u1', viewKey: 'treasury-payment-orders' } },
    });
    expect(result).toEqual({ viewKey: 'treasury-payment-orders', mode: 'LIST' });
  });

  test('getPreference devuelve el valor guardado si existe', async () => {
    prisma.viewModePreference.findUnique.mockResolvedValue({ viewKey: 'treasury-payment-orders', mode: 'CALENDAR' });
    const result = await viewPreferencesService.getPreference('u1', 'treasury-payment-orders');
    expect(result).toEqual({ viewKey: 'treasury-payment-orders', mode: 'CALENDAR' });
  });

  test('setPreference hace upsert por [userId, viewKey]', async () => {
    prisma.viewModePreference.upsert.mockResolvedValue({ viewKey: 'treasury-payment-orders', mode: 'KANBAN' });
    const result = await viewPreferencesService.setPreference('c1', 'u1', 'treasury-payment-orders', 'KANBAN');
    expect(prisma.viewModePreference.upsert).toHaveBeenCalledWith({
      where: { userId_viewKey: { userId: 'u1', viewKey: 'treasury-payment-orders' } },
      update: { mode: 'KANBAN' },
      create: { companyId: 'c1', userId: 'u1', viewKey: 'treasury-payment-orders', mode: 'KANBAN' },
    });
    expect(result).toEqual({ viewKey: 'treasury-payment-orders', mode: 'KANBAN' });
  });
});
