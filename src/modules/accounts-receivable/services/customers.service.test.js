jest.mock('../../../core/database/prisma', () => ({
  customer: { create: jest.fn() },
}));
jest.mock('../../../core/audit/audit.service', () => ({ log: jest.fn() }));

const prisma = require('../../../core/database/prisma');
const customersService = require('./customers.service');

describe('customers.service.importCustomers', () => {
  beforeEach(() => jest.clearAllMocks());

  test('cuenta cada fila creada con éxito', async () => {
    prisma.customer.create.mockResolvedValue({ id: 'c1' });
    const result = await customersService.importCustomers('company-1', [{ name: 'Cliente A' }, { name: 'Cliente B' }]);
    expect(result).toEqual({ created: 2, errors: [] });
  });

  // Bug real encontrado con Playwright: el mensaje de error de una
  // fila que falla mostraba el texto interno crudo de Prisma
  // ("Invalid `prisma.customer.create()` invocation...") en vez de
  // una explicación clara — nunca debe llegar un error técnico crudo
  // a la pantalla (regla del sistema de diseño del proyecto).
  test('traduce una violación de nombre duplicado (P2002) a un mensaje claro, nunca el error crudo de Prisma', async () => {
    const prismaError = new Error(
      "Invalid `prisma.customer.create()` invocation in\n/home/user/Alarfly/src/modules/accounts-receivable/services/customers.service.js:6:26\nUnique constraint failed on the fields: (`companyId`,`name`)"
    );
    prismaError.code = 'P2002';
    prisma.customer.create.mockRejectedValueOnce(prismaError).mockResolvedValueOnce({ id: 'c2' });

    const result = await customersService.importCustomers('company-1', [{ name: 'Cliente Repetido' }, { name: 'Cliente Nuevo' }]);

    expect(result.created).toBe(1);
    expect(result.errors).toEqual([{ row: 1, message: 'Ya existe un cliente con el nombre "Cliente Repetido".' }]);
    expect(result.errors[0].message).not.toMatch(/prisma\.customer\.create/);
  });

  test('un error inesperado también se traduce a un mensaje genérico, nunca crudo', async () => {
    prisma.customer.create.mockRejectedValueOnce(new TypeError('cannot read property of undefined'));
    const result = await customersService.importCustomers('company-1', [{ name: 'Cliente C' }]);
    expect(result.errors).toEqual([
      { row: 1, message: 'No se pudo crear este cliente. Revisa sus datos e intenta de nuevo.' },
    ]);
  });
});
