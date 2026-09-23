// Fase 2 (maestros): createCustomer ahora audita dentro de una
// transacción (mismo patrón ya establecido en el proyecto — ver
// petty-cash.service.test.js), así que `$transaction` se mockea
// pasándole a `tx` el mismo `customer.create` mockeado, para no
// cambiar el comportamiento observable de estos tests ya existentes.
jest.mock('../../../core/database/prisma', () => {
  const customer = { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() };
  return { customer, $transaction: jest.fn((cb) => cb({ customer })) };
});
jest.mock('../../../core/audit/audit.service', () => ({ log: jest.fn() }));

const prisma = require('../../../core/database/prisma');
const auditService = require('../../../core/audit/audit.service');
const customersService = require('./customers.service');

// Fase 2 (maestros): antes de esta fase, crear o modificar un cliente
// (incluida su activación/desactivación) no dejaba ningún rastro
// auditable — solo bloquear/desbloquear lo dejaba. Confirma que ahora
// sí, sin cambiar la forma del registro devuelto.
describe('customers.service — auditoría de creación y modificación', () => {
  beforeEach(() => jest.clearAllMocks());

  test('createCustomer audita la creación', async () => {
    prisma.customer.create.mockResolvedValue({ id: 'c1', name: 'Cliente Nuevo', taxId: null });
    const result = await customersService.createCustomer('company-1', { name: 'Cliente Nuevo' }, 'user-1');

    expect(result).toEqual({ id: 'c1', name: 'Cliente Nuevo', taxId: null });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'company-1', userId: 'user-1', action: 'customer.created', entityType: 'Customer', entityId: 'c1' }),
      expect.anything()
    );
  });

  test('updateCustomer audita la modificación, incluida la desactivación', async () => {
    prisma.customer.findFirst.mockResolvedValue({ id: 'c1', isActive: true });
    prisma.customer.update.mockResolvedValue({ id: 'c1', isActive: false });

    const result = await customersService.updateCustomer('company-1', 'c1', { isActive: false }, 'user-1');

    expect(result).toEqual({ id: 'c1', isActive: false });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        userId: 'user-1',
        action: 'customer.updated',
        entityType: 'Customer',
        entityId: 'c1',
        oldValue: { isActive: true },
        newValue: { isActive: false },
      }),
      expect.anything()
    );
  });

  test('updateCustomer rechaza un cliente inexistente antes de tocar la base de datos', async () => {
    prisma.customer.findFirst.mockResolvedValue(null);
    await expect(customersService.updateCustomer('company-1', 'no-existe', { name: 'X' })).rejects.toThrow('El cliente indicado no existe.');
    expect(prisma.customer.update).not.toHaveBeenCalled();
  });
});

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
