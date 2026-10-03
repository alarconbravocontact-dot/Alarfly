// Pruebas de integración contra Postgres real (sin mocks) — mismo
// criterio que signup.integration.test.js, del que esta pieza depende
// directamente (la atribución ocurre DENTRO de auth.service.signup).
require('../config');
const prisma = require('../database/prisma');
const authService = require('../auth/auth.service');
const affiliateAuthService = require('./affiliate-auth.service');
const affiliatesService = require('./affiliates.service');
const adminService = require('./affiliate-admin.service');
const settingsService = require('./affiliate-settings.service');

let counter = 0;
function unique(prefix) {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}

async function cleanupAffiliate(affiliateId) {
  if (!affiliateId) return;
  const referrals = await prisma.affiliateReferral.findMany({ where: { affiliateId }, select: { referredCompanyId: true } });
  await prisma.affiliateCommission.deleteMany({ where: { affiliateId } });
  await prisma.affiliateReferral.deleteMany({ where: { affiliateId } });
  await prisma.auditLog.deleteMany({
    where: { OR: [{ entityType: 'Affiliate', entityId: affiliateId }, { entityType: 'AffiliateReferral' }, { entityType: 'AffiliateCommission' }] },
  });
  await prisma.affiliate.delete({ where: { id: affiliateId } }).catch(() => {});
  for (const { referredCompanyId } of referrals) {
    await prisma.auditLog.deleteMany({ where: { companyId: referredCompanyId } });
    await prisma.user.deleteMany({ where: { companyId: referredCompanyId } });
    await prisma.company.deleteMany({ where: { id: referredCompanyId } });
  }
}

describe('Fase Afiliados — flujo completo (integración real)', () => {
  const createdAffiliateIds = [];
  const createdCompanyIds = [];
  let platformAdminUserId;
  let platformAdminCompanyId;

  beforeAll(async () => {
    // El administrador de plataforma SIGUE siendo un User real (ver
    // affiliate-admin.middleware.js) — AuditLog.userId exige que exista
    // de verdad, así que el fixture lo crea como cualquier otra prueba
    // de integración del proyecto, solo que además con el flag en true.
    const company = await prisma.company.create({ data: { name: unique('Empresa Operadora') } });
    platformAdminCompanyId = company.id;
    const admin = await prisma.user.create({
      data: {
        companyId: company.id,
        name: 'Administrador de Plataforma',
        email: `${unique('platform-admin')}@example.com`,
        role: 'ADMIN',
        status: 'ACTIVE',
        isActive: true,
        isAffiliateProgramAdmin: true,
      },
    });
    platformAdminUserId = admin.id;
  });

  afterAll(async () => {
    if (platformAdminCompanyId) {
      await prisma.auditLog.deleteMany({ where: { companyId: platformAdminCompanyId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { companyId: platformAdminCompanyId } }).catch(() => {});
      await prisma.company.deleteMany({ where: { id: platformAdminCompanyId } }).catch(() => {});
    }
    for (const id of createdAffiliateIds) {
       
      await cleanupAffiliate(id);
    }
    for (const companyId of createdCompanyIds) {
       
      await prisma.auditLog.deleteMany({ where: { companyId } }).catch(() => {});
       
      await prisma.user.deleteMany({ where: { companyId } }).catch(() => {});
       
      await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  test('ciclo completo: afiliado se registra, su enlace atribuye un referido real, genera comisión trazable, y un admin la aprueba/paga', async () => {
    // 1) El afiliado se registra (nunca fue usuario de Alarfly).
    const affiliateEmail = `${unique('afiliado')}@example.com`;
    const { affiliate: affiliateSession } = await affiliateAuthService.registerAffiliate('Afiliada de Prueba', affiliateEmail, 'ClaveFuerte123!');
    createdAffiliateIds.push(affiliateSession.id);
    expect(affiliateSession.code).toMatch(/^AF-[A-Z2-9]{6}$/);

    // 2) Login real del afiliado con su propio sistema de auth (distinto a core/auth).
    const loginResult = await affiliateAuthService.loginAffiliate(affiliateEmail, 'ClaveFuerte123!');
    expect(loginResult.token).toBeTruthy();

    // 3) Un visitante usa el enlace y se registra como empresa nueva —
    // el flujo real pasa por auth.service.signup con referralCode.
    const referredEmail = `${unique('referido')}@example.com`;
    const session = await authService.signup('Empresa Referida', 'Dueño Referido', referredEmail, 'ClaveFuerte123!', {
      referralCode: affiliateSession.code,
    });
    createdCompanyIds.push(session.user.companyId);

    // 4) La atribución quedó real y trazable.
    const referrals = await affiliatesService.listReferrals(affiliateSession.id);
    expect(referrals).toHaveLength(1);
    expect(referrals[0].referredCompany.id).toBe(session.user.companyId);
    expect(referrals[0].codeUsed).toBe(affiliateSession.code);

    // 5) La comisión se generó sola, en PENDING, con un monto calculado
    // por el servidor (nunca por el cliente).
    const commissions = await affiliatesService.listCommissions(affiliateSession.id);
    expect(commissions).toHaveLength(1);
    expect(commissions[0].status).toBe('PENDING');
    expect(Number(commissions[0].amount)).toBeGreaterThan(0);

    // 6) El resumen del tablero del afiliado refleja el referido y la comisión.
    const summary = await affiliatesService.getSummary(affiliateSession.id);
    expect(summary.referralsCount).toBe(1);
    expect(summary.commissionTotals.PENDING).toBeGreaterThan(0);

    // 7) Un administrador de plataforma aprueba y luego paga la comisión,
    // respetando el ciclo de estados (nunca "pagada" sin pasar por los pasos).
    const approved = await adminService.transitionCommissionStatus(commissions[0].id, 'APPROVED', platformAdminUserId);
    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedAt).toBeTruthy();

    await expect(adminService.transitionCommissionStatus(commissions[0].id, 'PAID', platformAdminUserId)).rejects.toThrow();

    const payable = await adminService.transitionCommissionStatus(commissions[0].id, 'PAYABLE', platformAdminUserId);
    expect(payable.status).toBe('PAYABLE');

    const paid = await adminService.transitionCommissionStatus(commissions[0].id, 'PAID', platformAdminUserId);
    expect(paid.status).toBe('PAID');
    expect(paid.paidAt).toBeTruthy();

    // 8) El historial de auditoría cruzado del programa registró cada paso.
    const trail = await adminService.listAuditTrail();
    const actions = trail.filter((entry) => entry.entityId === commissions[0].id).map((entry) => entry.action);
    expect(actions).toEqual(expect.arrayContaining(['affiliate_commission.status_changed']));
  });

  test('autorreferido: el propio afiliado no puede atribuirse su propio registro', async () => {
    const email = `${unique('yo-mismo')}@example.com`;
    const { affiliate } = await affiliateAuthService.registerAffiliate('Yo Mismo', email, 'ClaveFuerte123!');
    createdAffiliateIds.push(affiliate.id);

    // El afiliado intenta registrar una empresa usando SU PROPIO correo
    // y su propio código de referido.
    const session = await authService.signup('Mi Propia Empresa', 'Yo Mismo', email, 'ClaveFuerte123!', {
      referralCode: affiliate.code,
    });
    createdCompanyIds.push(session.user.companyId);

    const referrals = await affiliatesService.listReferrals(affiliate.id);
    expect(referrals).toHaveLength(0); // el signup se completó, pero nunca se atribuyó
  });

  test('código inválido o inexistente no bloquea el registro (mejor-esfuerzo, nunca un error)', async () => {
    const email = `${unique('codigo-falso')}@example.com`;
    const session = await authService.signup('Empresa Sin Afiliado', 'Dueña', email, 'ClaveFuerte123!', {
      referralCode: 'AF-NOEXISTE',
    });
    createdCompanyIds.push(session.user.companyId);
    expect(session.token).toBeTruthy(); // el signup funcionó igual
  });

  test('idempotencia en base de datos: un referral nunca puede quedar atribuido a dos afiliados', async () => {
    const affiliateAEmail = `${unique('afiliado-a')}@example.com`;
    const affiliateBEmail = `${unique('afiliado-b')}@example.com`;
    const { affiliate: affiliateA } = await affiliateAuthService.registerAffiliate('Afiliado A', affiliateAEmail, 'ClaveFuerte123!');
    const { affiliate: affiliateB } = await affiliateAuthService.registerAffiliate('Afiliado B', affiliateBEmail, 'ClaveFuerte123!');
    createdAffiliateIds.push(affiliateA.id, affiliateB.id);

    const referredEmail = `${unique('referido-unico')}@example.com`;
    const session = await authService.signup('Empresa Única', 'Dueño', referredEmail, 'ClaveFuerte123!', {
      referralCode: affiliateA.code,
    });
    createdCompanyIds.push(session.user.companyId);

    // Un segundo intento de atribuir la MISMA empresa a otro afiliado,
    // directo contra el servicio (simula una llamada repetida/maliciosa)
    // debe chocar con la restricción única de base de datos.
    await expect(
      prisma.affiliateReferral.create({
        data: { affiliateId: affiliateB.id, referredCompanyId: session.user.companyId, codeUsed: affiliateB.code },
      })
    ).rejects.toThrow();

    const referralsA = await affiliatesService.listReferrals(affiliateA.id);
    const referralsB = await affiliatesService.listReferrals(affiliateB.id);
    expect(referralsA).toHaveLength(1);
    expect(referralsB).toHaveLength(0);
  });

  test('idempotencia de comisión: el mismo evento del mismo referido nunca genera dos comisiones', async () => {
    const affiliateEmail = `${unique('afiliado-idem')}@example.com`;
    const { affiliate } = await affiliateAuthService.registerAffiliate('Afiliado Idempotente', affiliateEmail, 'ClaveFuerte123!');
    createdAffiliateIds.push(affiliate.id);

    const referredEmail = `${unique('referido-idem')}@example.com`;
    const session = await authService.signup('Empresa Idempotente', 'Dueño', referredEmail, 'ClaveFuerte123!', {
      referralCode: affiliate.code,
    });
    createdCompanyIds.push(session.user.companyId);

    const referrals = await affiliatesService.listReferrals(affiliate.id);
    const settings = await settingsService.getSettings();

    await expect(
      prisma.affiliateCommission.create({
        data: {
          affiliateId: affiliate.id,
          referralId: referrals[0].id,
          eventType: 'SIGNUP',
          baseAmount: settings.referenceAmount,
          rateType: settings.rateType,
          rateValue: settings.rateValue,
          amount: settings.rateValue,
          currency: settings.currency,
        },
      })
    ).rejects.toThrow();
  });

  test('aislamiento entre afiliados: uno nunca ve los referidos/comisiones de otro', async () => {
    const emailA = `${unique('aislado-a')}@example.com`;
    const emailB = `${unique('aislado-b')}@example.com`;
    const { affiliate: affA } = await affiliateAuthService.registerAffiliate('Aislado A', emailA, 'ClaveFuerte123!');
    const { affiliate: affB } = await affiliateAuthService.registerAffiliate('Aislado B', emailB, 'ClaveFuerte123!');
    createdAffiliateIds.push(affA.id, affB.id);

    const referredEmail = `${unique('referido-aislado')}@example.com`;
    const session = await authService.signup('Empresa Aislada', 'Dueño', referredEmail, 'ClaveFuerte123!', {
      referralCode: affA.code,
    });
    createdCompanyIds.push(session.user.companyId);

    const referralsB = await affiliatesService.listReferrals(affB.id);
    const commissionsB = await affiliatesService.listCommissions(affB.id);
    expect(referralsB).toHaveLength(0);
    expect(commissionsB).toHaveLength(0);
  });

  test('un administrador de plataforma puede cancelar una comisión pendiente, con motivo', async () => {
    const affiliateEmail = `${unique('afiliado-cancel')}@example.com`;
    const { affiliate } = await affiliateAuthService.registerAffiliate('Afiliado Cancelado', affiliateEmail, 'ClaveFuerte123!');
    createdAffiliateIds.push(affiliate.id);

    const referredEmail = `${unique('referido-cancel')}@example.com`;
    const session = await authService.signup('Empresa Cancelada', 'Dueño', referredEmail, 'ClaveFuerte123!', {
      referralCode: affiliate.code,
    });
    createdCompanyIds.push(session.user.companyId);

    const commissions = await affiliatesService.listCommissions(affiliate.id);
    const cancelled = await adminService.transitionCommissionStatus(
      commissions[0].id,
      'CANCELLED',
      platformAdminUserId,
      'Referido fraudulento (prueba)'
    );
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.statusNote).toBe('Referido fraudulento (prueba)');

    // Terminal: ya no se puede mover a ningún otro estado.
    await expect(adminService.transitionCommissionStatus(commissions[0].id, 'APPROVED', platformAdminUserId)).rejects.toThrow();
  });
});
