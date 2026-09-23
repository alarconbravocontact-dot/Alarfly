jest.mock('../../database/prisma', () => ({
  company: { findUnique: jest.fn() },
  treasuryAccount: { count: jest.fn() },
  product: { count: jest.fn() },
  customer: { count: jest.fn() },
  user: { count: jest.fn() },
}));

const prisma = require('../../database/prisma');
const { getSetupStatus } = require('./setup-status.service');

describe('getSetupStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  test('muestra el paso de "primer producto" cuando la empresa usa Inventario', async () => {
    prisma.company.findUnique.mockResolvedValue({ rif: null, usesInventory: true });
    prisma.treasuryAccount.count.mockResolvedValue(0);
    prisma.product.count.mockResolvedValue(0);
    prisma.user.count.mockResolvedValue(1);

    const result = await getSetupStatus('c1');

    expect(prisma.customer.count).not.toHaveBeenCalled();
    const step = result.steps.find((s) => s.key === 'PRODUCT_OR_CLIENT');
    expect(step.label).toBe('Carga tu primer producto');
    expect(step.done).toBe(false);
    expect(result.allDone).toBe(false);
    expect(result.completedCount).toBe(0);
  });

  test('muestra el paso de "primer cliente" en vez de producto cuando no usa Inventario', async () => {
    prisma.company.findUnique.mockResolvedValue({ rif: null, usesInventory: false });
    prisma.treasuryAccount.count.mockResolvedValue(0);
    prisma.customer.count.mockResolvedValue(3);
    prisma.user.count.mockResolvedValue(1);

    const result = await getSetupStatus('c1');

    expect(prisma.product.count).not.toHaveBeenCalled();
    const step = result.steps.find((s) => s.key === 'PRODUCT_OR_CLIENT');
    expect(step.label).toBe('Registra tu primer cliente');
    expect(step.done).toBe(true);
  });

  test('marca datos fiscales como hechos solo si el RIF no está vacío', async () => {
    prisma.company.findUnique.mockResolvedValue({ rif: '   ', usesInventory: true });
    prisma.treasuryAccount.count.mockResolvedValue(0);
    prisma.product.count.mockResolvedValue(0);
    prisma.user.count.mockResolvedValue(1);

    const result = await getSetupStatus('c1');

    expect(result.steps.find((s) => s.key === 'FISCAL_DATA').done).toBe(false);
  });

  test('el paso de invitar usuario exige más de un usuario en la empresa', async () => {
    prisma.company.findUnique.mockResolvedValue({ rif: 'J-12345678-9', usesInventory: true });
    prisma.treasuryAccount.count.mockResolvedValue(1);
    prisma.product.count.mockResolvedValue(1);
    prisma.user.count.mockResolvedValue(2);

    const result = await getSetupStatus('c1');

    expect(result.steps.find((s) => s.key === 'INVITE_USER').done).toBe(true);
    expect(result.allDone).toBe(true);
    expect(result.completedCount).toBe(4);
  });
});
