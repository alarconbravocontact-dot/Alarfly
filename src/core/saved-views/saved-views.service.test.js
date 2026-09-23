jest.mock('../database/prisma', () => ({
  savedView: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
}));

const prisma = require('../database/prisma');
const savedViewsService = require('./saved-views.service');

describe('saved-views.service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('listSavedViews filtra por empresa y tabla', async () => {
    prisma.savedView.findMany.mockResolvedValue([]);
    await savedViewsService.listSavedViews('c1', 'ar-invoices');
    expect(prisma.savedView.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'c1', tableKey: 'ar-invoices' } })
    );
  });

  test('getSavedView rechaza una vista de otra empresa (no filtra solo por id)', async () => {
    prisma.savedView.findFirst.mockResolvedValue(null);
    await expect(savedViewsService.getSavedView('c1', 'v-de-otra-empresa')).rejects.toMatchObject({
      code: 'SAVED_VIEW_NOT_FOUND',
    });
    expect(prisma.savedView.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'v-de-otra-empresa', companyId: 'c1' } })
    );
  });

  test('deleteSavedView permite borrar a quien la creó', async () => {
    prisma.savedView.findFirst.mockResolvedValue({ id: 'v1', createdByUserId: 'u1' });
    prisma.savedView.delete.mockResolvedValue({});
    await savedViewsService.deleteSavedView('c1', 'u1', 'COLLABORATOR', 'v1');
    expect(prisma.savedView.delete).toHaveBeenCalledWith({ where: { id: 'v1' } });
  });

  test('deleteSavedView permite borrar a un Administrador aunque no la haya creado', async () => {
    prisma.savedView.findFirst.mockResolvedValue({ id: 'v1', createdByUserId: 'otro-usuario' });
    prisma.savedView.delete.mockResolvedValue({});
    await savedViewsService.deleteSavedView('c1', 'admin-1', 'ADMIN', 'v1');
    expect(prisma.savedView.delete).toHaveBeenCalledWith({ where: { id: 'v1' } });
  });

  test('deleteSavedView rechaza a un usuario que no la creó y no es Administrador', async () => {
    prisma.savedView.findFirst.mockResolvedValue({ id: 'v1', createdByUserId: 'otro-usuario' });
    await expect(savedViewsService.deleteSavedView('c1', 'u2', 'COLLABORATOR', 'v1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prisma.savedView.delete).not.toHaveBeenCalled();
  });
});
