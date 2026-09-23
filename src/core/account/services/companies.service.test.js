jest.mock('../../database/prisma', () => ({
  userCompanyAccess: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
}));
jest.mock('../../auth/auth.service', () => ({ buildSession: jest.fn(() => ({ token: 'fake-token', user: {} })) }));

const prisma = require('../../database/prisma');
const authService = require('../../auth/auth.service');
const companiesService = require('./companies.service');

describe('switchActiveCompany', () => {
  beforeEach(() => jest.clearAllMocks());

  // Requisito explícito: hoy nadie tiene acceso a una segunda empresa
  // salvo la fila que la migración le dio a su empresa original — este
  // test confirma que intentar cambiar a una empresa sin esa fila se
  // rechaza, en vez de dejar pasar cualquier companyId.
  test('rechaza cambiar a una empresa a la que no se tiene acceso', async () => {
    prisma.userCompanyAccess.findUnique.mockResolvedValue(null);

    await expect(companiesService.switchActiveCompany('u1', 's1', 'company-ajena')).rejects.toMatchObject({
      code: 'COMPANY_ACCESS_DENIED',
    });
    expect(authService.buildSession).not.toHaveBeenCalled();
  });

  test('permite cambiar a una empresa con acceso otorgado', async () => {
    prisma.userCompanyAccess.findUnique.mockResolvedValue({ userId: 'u1', companyId: 'company-2', isDefault: false });
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', name: 'Ana', email: 'ana@demo.com', role: 'ADMIN' });

    const result = await companiesService.switchActiveCompany('u1', 's1', 'company-2');
    expect(authService.buildSession).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), 's1', 'company-2');
    expect(result.token).toBe('fake-token');
  });
});
