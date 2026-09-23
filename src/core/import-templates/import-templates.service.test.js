jest.mock('../database/prisma', () => ({
  importTemplate: { findMany: jest.fn(), create: jest.fn(), findFirst: jest.fn(), delete: jest.fn() },
}));

const prisma = require('../database/prisma');
const importTemplatesService = require('./import-templates.service');

describe('import-templates.service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('listTemplates filtra por empresa y targetKey', async () => {
    prisma.importTemplate.findMany.mockResolvedValue([]);
    await importTemplatesService.listTemplates('c1', 'ar-customers');
    expect(prisma.importTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: 'c1', targetKey: 'ar-customers' } })
    );
  });

  test('deleteTemplate rechaza una plantilla de otra empresa (no filtra solo por id)', async () => {
    prisma.importTemplate.findFirst.mockResolvedValue(null);
    await expect(importTemplatesService.deleteTemplate('c1', 'u1', 'ADMIN', 'tpl-de-otra-empresa')).rejects.toMatchObject({
      code: 'IMPORT_TEMPLATE_NOT_FOUND',
    });
  });

  test('deleteTemplate permite borrar a quien la creó', async () => {
    prisma.importTemplate.findFirst.mockResolvedValue({ id: 't1', createdByUserId: 'u1' });
    prisma.importTemplate.delete.mockResolvedValue({});
    await importTemplatesService.deleteTemplate('c1', 'u1', 'COLLABORATOR', 't1');
    expect(prisma.importTemplate.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
  });

  test('deleteTemplate rechaza a un usuario que no la creó y no es Administrador', async () => {
    prisma.importTemplate.findFirst.mockResolvedValue({ id: 't1', createdByUserId: 'otro-usuario' });
    await expect(importTemplatesService.deleteTemplate('c1', 'u2', 'COLLABORATOR', 't1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
    expect(prisma.importTemplate.delete).not.toHaveBeenCalled();
  });
});
