jest.mock('../database/prisma', () => ({
  alert: { findMany: jest.fn() },
  userNotificationPreference: { findMany: jest.fn() },
}));
jest.mock('../audit/audit.service', () => ({ log: jest.fn() }));

const prisma = require('../database/prisma');
const alertsService = require('./alerts.service');

describe('alerts.service.listAlertsForUser', () => {
  beforeEach(() => jest.clearAllMocks());

  test('devuelve todas las alertas si el usuario nunca apagó ningún tipo', async () => {
    prisma.alert.findMany.mockResolvedValue([
      { id: 'a1', type: 'LOW_BALANCE' },
      { id: 'a2', type: 'PAYMENT_DUE_SOON' },
    ]);
    prisma.userNotificationPreference.findMany.mockResolvedValue([]);

    const result = await alertsService.listAlertsForUser('c1', 'u1', {});
    expect(result).toHaveLength(2);
  });

  test('excluye alertas de un tipo que el usuario apagó "en la aplicación"', async () => {
    prisma.alert.findMany.mockResolvedValue([
      { id: 'a1', type: 'LOW_BALANCE' },
      { id: 'a2', type: 'PAYMENT_DUE_SOON' },
      { id: 'a3', type: 'LOW_BALANCE' },
    ]);
    prisma.userNotificationPreference.findMany.mockResolvedValue([
      { alertType: 'LOW_BALANCE', inAppEnabled: false },
      { alertType: 'PAYMENT_DUE_SOON', inAppEnabled: true },
    ]);

    const result = await alertsService.listAlertsForUser('c1', 'u1', {});
    expect(result).toEqual([{ id: 'a2', type: 'PAYMENT_DUE_SOON' }]);
  });

  test('un tipo con inAppEnabled=true guardado explícitamente no se excluye', async () => {
    prisma.alert.findMany.mockResolvedValue([{ id: 'a1', type: 'LOW_STOCK' }]);
    prisma.userNotificationPreference.findMany.mockResolvedValue([{ alertType: 'LOW_STOCK', inAppEnabled: true }]);

    const result = await alertsService.listAlertsForUser('c1', 'u1', {});
    expect(result).toEqual([{ id: 'a1', type: 'LOW_STOCK' }]);
  });
});
