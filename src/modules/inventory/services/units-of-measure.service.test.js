// Fase 2 (maestros): UnitOfMeasure tenía el mismo hueco que
// ProductCategory — sin edición, sin desactivación, sin auditoría.
jest.mock('../../../core/database/prisma', () => {
  const unitOfMeasure = { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() };
  return { unitOfMeasure, $transaction: jest.fn((cb) => cb({ unitOfMeasure })) };
});
jest.mock('../../../core/audit/audit.service', () => ({ log: jest.fn() }));

const prisma = require('../../../core/database/prisma');
const auditService = require('../../../core/audit/audit.service');
const unitsService = require('./units-of-measure.service');

describe('units-of-measure.service', () => {
  beforeEach(() => jest.clearAllMocks());

  test('createUnitOfMeasure audita la creación', async () => {
    prisma.unitOfMeasure.create.mockResolvedValue({ id: 'u1', code: 'KG', name: 'Kilogramo' });

    const result = await unitsService.createUnitOfMeasure('company-1', { code: 'KG', name: 'Kilogramo' }, 'user-1');

    expect(result).toEqual({ id: 'u1', code: 'KG', name: 'Kilogramo' });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'unit_of_measure.created', entityType: 'UnitOfMeasure', entityId: 'u1' }),
      expect.anything()
    );
  });

  test('updateUnitOfMeasure rechaza una unidad inexistente', async () => {
    prisma.unitOfMeasure.findFirst.mockResolvedValue(null);
    await expect(unitsService.updateUnitOfMeasure('company-1', 'no-existe', { name: 'X' })).rejects.toThrow('La unidad de medida indicada no existe.');
  });

  test('updateUnitOfMeasure desactiva y audita el estado anterior', async () => {
    prisma.unitOfMeasure.findFirst.mockResolvedValue({ id: 'u1', isActive: true });
    prisma.unitOfMeasure.update.mockResolvedValue({ id: 'u1', isActive: false });

    const result = await unitsService.updateUnitOfMeasure('company-1', 'u1', { isActive: false }, 'user-1');

    expect(result).toEqual({ id: 'u1', isActive: false });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'unit_of_measure.updated', oldValue: { isActive: true }, newValue: { isActive: false } }),
      expect.anything()
    );
  });
});
