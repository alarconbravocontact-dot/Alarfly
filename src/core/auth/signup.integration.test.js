// Fase Landing — Registro Público: primera prueba de integración real
// contra Postgres de signup() — confirma que crea Company+User en una
// sola transacción (atomicidad), deja los campos de prueba exactos (7
// días), y que las 2 validaciones de negocio (correo duplicado,
// contraseña débil) funcionan antes de tocar la base de datos.
const { prisma, cleanupCompany } = require('../../test-helpers/integration-fixtures');
const authService = require('./auth.service');

let companyId;

afterEach(async () => {
  if (companyId) await cleanupCompany(companyId);
  companyId = undefined;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('signup — Registro Público', () => {
  test('crea una Company y un User ADMIN reales, con 7 días de prueba, y entrega sesión real', async () => {
    const email = `signup-${Date.now()}@example.com`;
    const before = Date.now();

    const session = await authService.signup('Ferretería El Tornillo', 'Carlos Gómez', email, 'Prueba1234');

    expect(session.token).toBeTruthy();
    expect(session.user.role).toBe('ADMIN');
    expect(session.user.email).toBe(email);
    companyId = session.user.companyId;

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    expect(company.name).toBe('Ferretería El Tornillo');
    expect(company.trialStartedAt).not.toBeNull();
    expect(company.trialEndsAt).not.toBeNull();
    const diffDays = (company.trialEndsAt.getTime() - company.trialStartedAt.getTime()) / (24 * 60 * 60 * 1000);
    expect(diffDays).toBeCloseTo(7, 5);
    expect(company.trialStartedAt.getTime()).toBeGreaterThanOrEqual(before);

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    expect(user.role).toBe('ADMIN');
    expect(user.status).toBe('ACTIVE');
    expect(user.isActive).toBe(true);
    expect(user.passwordHash).not.toBeNull();

    const sessionRow = await prisma.userSession.findFirst({ where: { userId: user.id } });
    expect(sessionRow).not.toBeNull();

    const auditRow = await prisma.auditLog.findFirst({ where: { companyId, action: 'company.signed_up' } });
    expect(auditRow).not.toBeNull();
    expect(auditRow.userId).toBe(user.id);
  });

  test('rechaza un correo ya registrado, sin crear una Company nueva (sin efecto parcial)', async () => {
    const email = `signup-dup-${Date.now()}@example.com`;
    const first = await authService.signup('Primera Empresa', 'Ana', email, 'Prueba1234');
    companyId = first.user.companyId;

    const countBefore = await prisma.company.count();
    await expect(authService.signup('Segunda Empresa', 'Beto', email, 'Prueba1234')).rejects.toMatchObject({
      code: 'EMAIL_ALREADY_REGISTERED',
    });
    const countAfter = await prisma.company.count();
    expect(countAfter).toBe(countBefore);
  });

  test('rechaza una contraseña débil antes de tocar la base de datos', async () => {
    const email = `signup-weak-${Date.now()}@example.com`;
    const countBefore = await prisma.company.count();

    await expect(authService.signup('Empresa', 'Dueño', email, 'minuscula1')).rejects.toMatchObject({
      code: 'WEAK_PASSWORD',
    });

    const countAfter = await prisma.company.count();
    expect(countAfter).toBe(countBefore);
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).toBeNull();
  });
});
