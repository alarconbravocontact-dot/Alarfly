jest.mock('../database/prisma', () => ({
  tableColumnPreference: { findMany: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
  $transaction: jest.fn((fn) =>
    fn({
      tableColumnPreference: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    })
  ),
}));

const prisma = require('../database/prisma');
const tablePreferencesService = require('./table-preferences.service');

describe('table-preferences.service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('getPreferences filtra por usuario y tabla, ordenado por order', async () => {
    prisma.tableColumnPreference.findMany.mockResolvedValue([]);
    await tablePreferencesService.getPreferences('u1', 'ar-invoices');
    expect(prisma.tableColumnPreference.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1', tableKey: 'ar-invoices' },
      orderBy: { order: 'asc' },
    });
  });

  test('savePreferences reemplaza todo dentro de una transacción (borra y vuelve a crear)', async () => {
    const txDeleteMany = jest.fn();
    const txCreateMany = jest.fn();
    const txFindMany = jest.fn().mockResolvedValue([{ columnKey: 'number' }]);
    prisma.$transaction.mockImplementation((fn) =>
      fn({ tableColumnPreference: { deleteMany: txDeleteMany, createMany: txCreateMany, findMany: txFindMany } })
    );

    const columns = [{ columnKey: 'number', isVisible: true, width: 80, order: 0 }];
    const result = await tablePreferencesService.savePreferences('c1', 'u1', 'ar-invoices', columns);

    expect(txDeleteMany).toHaveBeenCalledWith({ where: { userId: 'u1', tableKey: 'ar-invoices' } });
    expect(txCreateMany).toHaveBeenCalledWith({
      data: [{ companyId: 'c1', userId: 'u1', tableKey: 'ar-invoices', columnKey: 'number', isVisible: true, width: 80, order: 0 }],
    });
    expect(result).toEqual([{ columnKey: 'number' }]);
  });

  test('savePreferences con lista vacía solo borra, no crea nada (equivale a restablecer)', async () => {
    const txDeleteMany = jest.fn();
    const txCreateMany = jest.fn();
    const txFindMany = jest.fn().mockResolvedValue([]);
    prisma.$transaction.mockImplementation((fn) =>
      fn({ tableColumnPreference: { deleteMany: txDeleteMany, createMany: txCreateMany, findMany: txFindMany } })
    );

    await tablePreferencesService.savePreferences('c1', 'u1', 'ar-invoices', []);

    expect(txDeleteMany).toHaveBeenCalled();
    expect(txCreateMany).not.toHaveBeenCalled();
  });

  test('resetPreferences borra toda la configuración guardada de esa tabla para ese usuario', async () => {
    prisma.tableColumnPreference.deleteMany.mockResolvedValue({ count: 3 });
    await tablePreferencesService.resetPreferences('u1', 'ar-invoices');
    expect(prisma.tableColumnPreference.deleteMany).toHaveBeenCalledWith({ where: { userId: 'u1', tableKey: 'ar-invoices' } });
  });
});
