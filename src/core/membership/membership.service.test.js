const { Prisma } = require('@prisma/client');

const mockTx = {
  membershipPayment: { create: jest.fn(), update: jest.fn() },
  membership: { update: jest.fn() },
};

jest.mock('../database/prisma', () => ({
  plan: { findFirst: jest.fn(), create: jest.fn() },
  company: { findUnique: jest.fn() },
  membership: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  membershipPayment: { findUnique: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn((fn) => fn(mockTx)),
}));
jest.mock('../audit/audit.service', () => ({ log: jest.fn() }));

const prisma = require('../database/prisma');
const service = require('./membership.service');

const PLAN = {
  id: 'plan-1',
  code: 'STANDARD',
  name: 'Alarfly',
  priceAmount: new Prisma.Decimal('25'),
  currency: 'USD',
  billingPeriodDays: 30,
  trialDays: 7,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockTx.membershipPayment.create.mockReset();
  mockTx.membershipPayment.update.mockReset();
  mockTx.membership.update.mockReset();
});

describe('getActivePlan', () => {
  test('crea el plan único si todavía no existe en esta base de datos', async () => {
    prisma.plan.findFirst.mockResolvedValue(null);
    prisma.plan.create.mockResolvedValue(PLAN);

    const plan = await service.getActivePlan();

    expect(plan).toEqual(PLAN);
    expect(prisma.plan.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ code: 'STANDARD' }) })
    );
  });

  test('reutiliza el plan si ya existe (nunca crea un segundo)', async () => {
    prisma.plan.findFirst.mockResolvedValue(PLAN);

    const plan = await service.getActivePlan();

    expect(plan).toEqual(PLAN);
    expect(prisma.plan.create).not.toHaveBeenCalled();
  });
});

describe('getOrCreateMembership — aislamiento y estado inicial', () => {
  test('una empresa con prueba (trialEndsAt real) arranca en TRIALING', async () => {
    prisma.membership.findUnique.mockResolvedValue(null);
    prisma.company.findUnique.mockResolvedValue({ trialEndsAt: new Date('2026-12-01') });
    prisma.plan.findFirst.mockResolvedValue(PLAN);
    prisma.membership.create.mockResolvedValue({ id: 'm1', companyId: 'c1', status: 'TRIALING', plan: PLAN });

    const membership = await service.getOrCreateMembership('c1');

    expect(membership.status).toBe('TRIALING');
    expect(prisma.membership.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ companyId: 'c1', status: 'TRIALING' }) })
    );
  });

  test('una empresa sin fecha de prueba (creada antes de este módulo) arranca ACTIVE, sin inventar una prueba retroactiva', async () => {
    prisma.membership.findUnique.mockResolvedValue(null);
    prisma.company.findUnique.mockResolvedValue({ trialEndsAt: null });
    prisma.plan.findFirst.mockResolvedValue(PLAN);
    prisma.membership.create.mockResolvedValue({ id: 'm2', companyId: 'c2', status: 'ACTIVE', plan: PLAN });

    const membership = await service.getOrCreateMembership('c2');

    expect(membership.status).toBe('ACTIVE');
  });

  test('rechaza si la empresa no existe', async () => {
    prisma.membership.findUnique.mockResolvedValue(null);
    prisma.company.findUnique.mockResolvedValue(null);

    await expect(service.getOrCreateMembership('no-existe')).rejects.toMatchObject({ code: 'COMPANY_NOT_FOUND' });
  });

  test('nunca crea una segunda membresía si ya existe una', async () => {
    const existing = { id: 'm1', companyId: 'c1', status: 'ACTIVE', plan: PLAN };
    prisma.membership.findUnique.mockResolvedValue(existing);

    const membership = await service.getOrCreateMembership('c1');

    expect(membership).toBe(existing);
    expect(prisma.membership.create).not.toHaveBeenCalled();
  });
});

describe('submitPayment — seguridad (precio/plan siempre del servidor) e idempotencia', () => {
  test('el monto cobrado es el del plan real, nunca algo que venga del llamador', async () => {
    prisma.membershipPayment.findUnique.mockResolvedValue(null);
    prisma.membership.findUnique.mockResolvedValue({ id: 'm1', companyId: 'c1', status: 'TRIALING', plan: PLAN });
    prisma.company.findUnique.mockResolvedValue({ trialEndsAt: new Date('2099-01-01') });
    mockTx.membershipPayment.create.mockResolvedValue({ id: 'pay-1', amount: PLAN.priceAmount, currency: 'USD' });

    await service.submitPayment('c1', 'u1', {
      method: 'ZELLE',
      idempotencyKey: 'key-1',
      proof: { fileName: 'comprobante.png', mimeType: 'image/png', sizeBytes: 100, contentBase64: 'YQ==' },
    });

    expect(mockTx.membershipPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ amount: PLAN.priceAmount, currency: PLAN.currency, membershipId: 'm1' }),
      })
    );
  });

  test('un idempotencyKey ya usado devuelve el pago existente sin crear uno nuevo (doble clic/refresh)', async () => {
    const existingPayment = { id: 'pay-1', status: 'PENDING_REVIEW' };
    prisma.membershipPayment.findUnique.mockResolvedValue(existingPayment);

    const result = await service.submitPayment('c1', 'u1', { method: 'ZELLE', idempotencyKey: 'key-1', proof: {} });

    expect(result).toBe(existingPayment);
    expect(mockTx.membershipPayment.create).not.toHaveBeenCalled();
  });

  test('rechaza enviar un comprobante si la membresía ya está activa', async () => {
    prisma.membershipPayment.findUnique.mockResolvedValue(null);
    prisma.membership.findUnique.mockResolvedValue({
      id: 'm1',
      companyId: 'c1',
      status: 'ACTIVE',
      currentPeriodEnd: new Date('2099-01-01'),
      plan: PLAN,
    });
    prisma.company.findUnique.mockResolvedValue({ trialEndsAt: null });

    await expect(
      service.submitPayment('c1', 'u1', { method: 'ZELLE', idempotencyKey: 'key-2', proof: {} })
    ).rejects.toMatchObject({ code: 'MEMBERSHIP_PAYMENT_NOT_APPLICABLE' });
    expect(mockTx.membershipPayment.create).not.toHaveBeenCalled();
  });
});

describe('decidePayment — maker-checker de plataforma', () => {
  test('aprobar activa la membresía y fija el fin del período pagado', async () => {
    prisma.membershipPayment.findUnique.mockResolvedValue({
      id: 'pay-1',
      membershipId: 'm1',
      status: 'PENDING_REVIEW',
      membership: { plan: PLAN, currentPeriodEnd: null, company: { trialEndsAt: null } },
    });
    mockTx.membershipPayment.update.mockResolvedValue({ id: 'pay-1', status: 'CONFIRMED' });

    const result = await service.decidePayment('pay-1', 'admin-1', { approve: true });

    expect(result.status).toBe('CONFIRMED');
    expect(mockTx.membership.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'm1' },
        data: expect.objectContaining({ status: 'ACTIVE', currentPeriodEnd: expect.any(Date) }),
      })
    );
  });

  test('rechazar un comprobante NUNCA activa la membresía', async () => {
    prisma.membershipPayment.findUnique.mockResolvedValue({
      id: 'pay-1',
      membershipId: 'm1',
      status: 'PENDING_REVIEW',
      membership: {
        status: 'PENDING_PAYMENT',
        plan: PLAN,
        currentPeriodEnd: null,
        company: { trialEndsAt: new Date('2099-01-01') },
      },
    });
    mockTx.membershipPayment.update.mockResolvedValue({ id: 'pay-1', status: 'REJECTED' });

    const result = await service.decidePayment('pay-1', 'admin-1', { approve: false, note: 'comprobante inválido' });

    expect(result.status).toBe('REJECTED');
    expect(mockTx.membership.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'TRIALING' }) })
    );
  });

  test('rechazar un comprobante viejo/duplicado NUNCA degrada una membresía que otro pago ya activó', async () => {
    prisma.membershipPayment.findUnique.mockResolvedValue({
      id: 'pay-stale',
      membershipId: 'm1',
      status: 'PENDING_REVIEW',
      membership: {
        status: 'ACTIVE',
        plan: PLAN,
        currentPeriodEnd: new Date('2099-01-01'),
        company: { trialEndsAt: new Date('2026-01-01') },
      },
    });
    mockTx.membershipPayment.update.mockResolvedValue({ id: 'pay-stale', status: 'REJECTED' });

    const result = await service.decidePayment('pay-stale', 'admin-1', { approve: false });

    expect(result.status).toBe('REJECTED');
    expect(mockTx.membership.update).not.toHaveBeenCalled();
  });

  test('rechaza decidir un pago que ya fue revisado (evita doble decisión)', async () => {
    prisma.membershipPayment.findUnique.mockResolvedValue({ id: 'pay-1', status: 'CONFIRMED' });

    await expect(service.decidePayment('pay-1', 'admin-1', { approve: true })).rejects.toMatchObject({
      code: 'MEMBERSHIP_PAYMENT_ALREADY_DECIDED',
    });
  });

  test('rechaza si el pago no existe', async () => {
    prisma.membershipPayment.findUnique.mockResolvedValue(null);

    await expect(service.decidePayment('no-existe', 'admin-1', { approve: true })).rejects.toMatchObject({
      code: 'MEMBERSHIP_PAYMENT_NOT_FOUND',
    });
  });
});
