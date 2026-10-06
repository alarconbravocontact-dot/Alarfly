// Mismo patrón que vendors.service.test.js (AP) — mockea Prisma,
// confirma que crear/editar deja rastro auditable y que un empleado
// inexistente (o de otra empresa, ya que el `where` siempre incluye
// companyId) se rechaza antes de tocar nada.
jest.mock('../../../core/database/prisma', () => {
  const employee = { create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), findMany: jest.fn() };
  const dimension = { findFirst: jest.fn() };
  const fpaDimension = { findFirst: jest.fn() };
  return { employee, dimension, fpaDimension, $transaction: jest.fn((cb) => cb({ employee, dimension, fpaDimension })) };
});
jest.mock('../../../core/audit/audit.service', () => ({ log: jest.fn() }));

const prisma = require('../../../core/database/prisma');
const auditService = require('../../../core/audit/audit.service');
const employeesService = require('./employees.service');

describe('employees.service.createEmployee', () => {
  beforeEach(() => jest.clearAllMocks());

  test('crea el empleado y audita la creación', async () => {
    prisma.employee.findFirst.mockResolvedValue(null); // sin documentId duplicado
    prisma.employee.create.mockResolvedValue({ id: 'e1', firstName: 'Laura', lastName: 'Gómez', position: 'Vendedora' });

    const result = await employeesService.createEmployee('company-1', 'user-1', {
      firstName: 'Laura',
      lastName: 'Gómez',
      position: 'Vendedora',
      hireDate: new Date('2025-01-01'),
      baseSalary: 500,
      currency: 'USD',
    });

    expect(result.id).toBe('e1');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ companyId: 'company-1', userId: 'user-1', action: 'employee.created', entityType: 'Employee', entityId: 'e1' }),
      expect.anything()
    );
  });

  test('rechaza un documento de identidad duplicado en la misma empresa', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'otro', documentId: 'V-1' });

    await expect(
      employeesService.createEmployee('company-1', 'user-1', {
        firstName: 'A',
        lastName: 'B',
        position: 'X',
        hireDate: new Date(),
        baseSalary: 100,
        currency: 'USD',
        documentId: 'V-1',
      })
    ).rejects.toThrow('Ya existe un empleado con el documento');
    expect(prisma.employee.create).not.toHaveBeenCalled();
  });

  test('rechaza una sucursal (Dimension) que no existe en la empresa', async () => {
    prisma.dimension.findFirst.mockResolvedValue(null);

    await expect(
      employeesService.createEmployee('company-1', 'user-1', {
        firstName: 'A',
        lastName: 'B',
        position: 'X',
        hireDate: new Date(),
        baseSalary: 100,
        currency: 'USD',
        branchDimensionId: 'dim-otra-empresa',
      })
    ).rejects.toThrow('La sucursal indicada no existe');
  });
});

describe('employees.service.updateEmployee', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rechaza un empleado inexistente (o de otra empresa — el where siempre filtra por companyId)', async () => {
    prisma.employee.findFirst.mockResolvedValue(null);
    await expect(employeesService.updateEmployee('company-1', 'no-existe', 'user-1', { position: 'X' })).rejects.toThrow(
      'El empleado indicado no existe.'
    );
    expect(prisma.employee.update).not.toHaveBeenCalled();
  });

  test('activar/desactivar (status) se audita como "información sensible"', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'e1', status: 'ACTIVE', baseSalary: 500 });
    prisma.employee.update.mockResolvedValue({ id: 'e1', status: 'INACTIVE' });

    const result = await employeesService.updateEmployee('company-1', 'e1', 'user-1', { status: 'INACTIVE' });

    expect(result.status).toBe('INACTIVE');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'employee.sensitive_info_updated',
        entityType: 'Employee',
        entityId: 'e1',
        oldValue: { status: 'ACTIVE' },
        newValue: { status: 'INACTIVE' },
      }),
      expect.anything()
    );
  });

  test('un cambio no sensible (ej. teléfono) se audita distinto, sin oldValue', async () => {
    prisma.employee.findFirst.mockResolvedValue({ id: 'e1', phone: '000' });
    prisma.employee.update.mockResolvedValue({ id: 'e1', phone: '111' });

    await employeesService.updateEmployee('company-1', 'e1', 'user-1', { phone: '111' });

    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'employee.updated' }), expect.anything());
  });
});

describe('employees.service.listEmployees', () => {
  beforeEach(() => jest.clearAllMocks());

  test('siempre filtra por companyId, nunca devuelve empleados de otra empresa', async () => {
    prisma.employee.findMany.mockResolvedValue([]);
    await employeesService.listEmployees('company-1', {});
    expect(prisma.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-1' }) })
    );
  });
});
