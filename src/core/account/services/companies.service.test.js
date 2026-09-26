jest.mock('../../database/prisma', () => ({
  userCompanyAccess: { findUnique: jest.fn(), findMany: jest.fn() },
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

  // Bug real corregido en Etapa 7: sin ninguna fila en
  // `UserCompanyAccess` (el caso de todo usuario creado fuera de la
  // migración que llenó esa tabla a mano), "cambiar" a la propia
  // empresa por defecto del usuario no debía rechazarse.
  test('permite "cambiar" a la propia empresa por defecto sin fila explícita de acceso', async () => {
    prisma.userCompanyAccess.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', companyId: 'company-1', name: 'Ana', role: 'ADMIN' });

    const result = await companiesService.switchActiveCompany('u1', 's1', 'company-1');
    expect(authService.buildSession).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }), 's1', 'company-1');
    expect(result.token).toBe('fake-token');
  });
});

describe('listMyCompanies', () => {
  beforeEach(() => jest.clearAllMocks());

  test('devuelve las filas de UserCompanyAccess cuando existen', async () => {
    const rows = [{ companyId: 'company-1', isDefault: true, company: { id: 'company-1', name: 'Empresa Demo' } }];
    prisma.userCompanyAccess.findMany.mockResolvedValue(rows);

    const result = await companiesService.listMyCompanies('u1');
    expect(result).toBe(rows);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  // Bug real corregido en Etapa 7: sin filas en UserCompanyAccess (el
  // caso real de este entorno — 15 usuarios, 0 filas), la empresa por
  // defecto del usuario (`User.companyId`, columna obligatoria) se
  // deriva al leer, en vez de devolver una lista vacía que dejaba
  // "Empresa activa" con paréntesis vacíos en la interfaz.
  test('deriva la empresa por defecto desde User.companyId cuando no hay filas', async () => {
    prisma.userCompanyAccess.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockResolvedValue({
      companyId: 'company-1',
      company: { id: 'company-1', name: 'Empresa Demo' },
    });

    const result = await companiesService.listMyCompanies('u1');
    expect(result).toEqual([{ companyId: 'company-1', isDefault: true, company: { id: 'company-1', name: 'Empresa Demo' } }]);
  });

  test('devuelve una lista vacía si el usuario ya no existe', async () => {
    prisma.userCompanyAccess.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await companiesService.listMyCompanies('u1');
    expect(result).toEqual([]);
  });
});
