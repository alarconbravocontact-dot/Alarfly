// Fase 6 (sección 41): toda modificación sensible de una tasa debe
// quedar auditada (quién/cuándo/qué tasa/valor anterior/valor nuevo) —
// antes de esta fase, `recordRate` nunca llamaba a `core/audit`. Se
// prueba contra Postgres real porque lo que importa es la fila real
// de AuditLog que queda, no solo que la función "no truene".
const { prisma, createCompany, createUser } = require('../../test-helpers/integration-fixtures');
const fxService = require('./fx.service');

let company;
let user;

beforeEach(async () => {
  company = await createCompany();
  user = await createUser(company.id);
});

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { companyId: company.id } });
  await prisma.exchangeRate.deleteMany({ where: { companyId: company.id } });
  await prisma.user.deleteMany({ where: { companyId: company.id } });
  await prisma.company.deleteMany({ where: { id: company.id } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('recordRate — auditoría (sección 41) y origen (sección 43)', () => {
  test('registrar una tasa nueva queda auditada, con source BCV por defecto', async () => {
    const date = new Date('2026-09-01');
    const rate = await fxService.recordRate({ companyId: company.id, userId: user.id, currency: 'VES', rate: 0.025, date });

    expect(rate.source).toBe('BCV');

    const logs = await prisma.auditLog.findMany({ where: { companyId: company.id, entityType: 'ExchangeRate' } });
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('exchange_rate.recorded');
    expect(logs[0].userId).toBe(user.id);
    expect(logs[0].oldValue).toBeNull();
    expect(logs[0].newValue).toMatchObject({ currency: 'VES', rate: 0.025, source: 'BCV' });
  });

  test('registrar una tasa MANUAL guarda ese origen, distinto de BCV', async () => {
    const rate = await fxService.recordRate({
      companyId: company.id,
      userId: user.id,
      currency: 'EUR',
      rate: 1.1,
      date: new Date('2026-09-01'),
      source: 'MANUAL',
    });
    expect(rate.source).toBe('MANUAL');
  });

  test('volver a registrar la MISMA fecha corrige la fila y audita con el valor anterior y el nuevo', async () => {
    const date = new Date('2026-09-01');
    await fxService.recordRate({ companyId: company.id, userId: user.id, currency: 'VES', rate: 36, date });
    const updated = await fxService.recordRate({ companyId: company.id, userId: user.id, currency: 'VES', rate: 37, date });

    expect(Number(updated.rate)).toBe(37);
    // Sigue siendo la MISMA fila (mismo id, mismo día) — no se creó una
    // segunda fecha para "corregir" la anterior.
    const allForDate = await prisma.exchangeRate.findMany({ where: { companyId: company.id, currency: 'VES', date } });
    expect(allForDate).toHaveLength(1);

    const logs = await prisma.auditLog.findMany({
      where: { companyId: company.id, entityType: 'ExchangeRate' },
      orderBy: { createdAt: 'asc' },
    });
    expect(logs).toHaveLength(2);
    expect(logs[1].action).toBe('exchange_rate.updated');
    expect(logs[1].oldValue).toMatchObject({ rate: 36 });
    expect(logs[1].newValue).toMatchObject({ rate: 37 });
  });
});
