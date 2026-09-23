// Fase 2 (maestros): Vendor no tenía ningún test unitario. Antes de esta
// fase tampoco auditaba nada (ni siquiera activar/desactivar, que el
// frontend de VendorsPage ya permitía hacer). Estos tests confirman que
// crear/modificar un proveedor deja rastro auditable, mismo patrón ya
// probado en customers.service.test.js.
jest.mock('../../../core/database/prisma', () => {
  const vendor = { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() };
  return { vendor, $transaction: jest.fn((cb) => cb({ vendor })) };
});
jest.mock('../../../core/audit/audit.service', () => ({ log: jest.fn() }));

const prisma = require('../../../core/database/prisma');
const auditService = require('../../../core/audit/audit.service');
const vendorsService = require('./vendors.service');

describe('vendors.service.createVendor', () => {
  beforeEach(() => jest.clearAllMocks());

  test('crea el proveedor y audita la creación', async () => {
    prisma.vendor.create.mockResolvedValue({ id: 'v1', name: 'Proveedor Nuevo', taxId: null });

    const result = await vendorsService.createVendor('company-1', { name: 'Proveedor Nuevo' }, 'user-1');

    expect(result).toEqual({ id: 'v1', name: 'Proveedor Nuevo', taxId: null });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'company-1', userId: 'user-1', action: 'vendor.created', entityType: 'Vendor', entityId: 'v1' }),
      expect.anything()
    );
  });
});

describe('vendors.service.updateVendor', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rechaza un proveedor inexistente', async () => {
    prisma.vendor.findFirst.mockResolvedValue(null);
    await expect(vendorsService.updateVendor('company-1', 'no-existe', { name: 'X' })).rejects.toThrow('El proveedor indicado no existe.');
    expect(prisma.vendor.update).not.toHaveBeenCalled();
  });

  test('audita la desactivación, incluido el estado anterior', async () => {
    prisma.vendor.findFirst.mockResolvedValue({ id: 'v1', isActive: true });
    prisma.vendor.update.mockResolvedValue({ id: 'v1', isActive: false });

    const result = await vendorsService.updateVendor('company-1', 'v1', { isActive: false }, 'user-1');

    expect(result).toEqual({ id: 'v1', isActive: false });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'vendor.updated',
        entityType: 'Vendor',
        entityId: 'v1',
        oldValue: { isActive: true },
        newValue: { isActive: false },
      }),
      expect.anything()
    );
  });
});
