// Fase 11 (sección 16 — "las alertas deben apuntar a acciones"): antes
// de esta fase, una orden de pago pendiente de aprobación nunca
// generaba ninguna alerta ni notificación real. Este test prueba
// contra Postgres real el ciclo completo: enviar a aprobación crea la
// alerta del nivel 1, un nivel intermedio crea la del nivel siguiente,
// y tanto el rechazo como la aprobación final cierran (ACKNOWLEDGED)
// cualquier alerta de esa orden que siguiera activa — nunca deja una
// alerta "pendiente" mostrando una orden que ya se resolvió.
const {
  prisma,
  createCompany,
  createUser,
  createAccount,
  createOpenPeriod,
  createTreasuryAccount,
  cleanupCompany,
} = require('../../../test-helpers/integration-fixtures');
const paymentOrdersService = require('./payment-orders.service');
const alertsService = require('../../../core/alerts/alerts.service');

let scenario;

async function buildScenario() {
  const company = await createCompany();
  const requester = await createUser(company.id, 'COLLABORATOR');
  const level1Approver = await createUser(company.id, 'ACCOUNTANT');
  const level2Approver = await createUser(company.id, 'ADMIN');
  const bankGlAccount = await createAccount(company.id, { type: 'ASSET', normalBalance: 'DEBIT' });
  const expenseAccount = await createAccount(company.id, { type: 'EXPENSE', normalBalance: 'DEBIT' });
  await createOpenPeriod(company.id);
  const treasuryAccount = await createTreasuryAccount(company.id, bankGlAccount.id, 100000, 'USD');

  const rule = await prisma.paymentApprovalRule.create({
    data: {
      companyId: company.id,
      name: 'Regla de prueba F11',
      minAmount: 0,
      maxAmount: null,
      levels: {
        create: [
          { level: 1, allowedRoles: ['ACCOUNTANT'] },
          { level: 2, allowedRoles: ['ADMIN'] },
        ],
      },
    },
  });

  return { company, requester, level1Approver, level2Approver, treasuryAccount, expenseAccount, rule };
}

async function alertsForOrder(companyId, orderId) {
  const alerts = await prisma.alert.findMany({
    where: { companyId, type: 'APPROVAL_PENDING', entityType: 'PaymentOrder', entityId: { startsWith: `${orderId}:` } },
  });
  return alerts;
}

beforeEach(async () => {
  scenario = await buildScenario();
});

afterEach(async () => {
  await prisma.alert.deleteMany({ where: { companyId: scenario.company.id } });
  await cleanupCompany(scenario.company.id);
});

describe('Alertas de aprobación pendiente en órdenes de pago (Fase 11)', () => {
  test('enviar a aprobación crea la alerta del nivel 1; aprobar el nivel 1 la cierra y crea la del nivel 2; rechazar cierra todo', async () => {
    const { company, requester, level1Approver, level2Approver, treasuryAccount, expenseAccount } = scenario;

    const order = await paymentOrdersService.createPaymentOrder(company.id, requester.id, {
      treasuryAccountId: treasuryAccount.id,
      glAccountId: expenseAccount.id,
      payeeName: 'Proveedor de prueba',
      amount: 1000,
      currency: 'USD',
      description: 'Pago de prueba F11',
      scheduledDate: new Date(),
    });

    await paymentOrdersService.submitForApproval(company.id, order.id, requester.id);

    let alerts = await alertsForOrder(company.id, order.id);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].entityId).toBe(`${order.id}:level:1`);
    expect(alerts[0].status).toBe('ACTIVE');
    expect(alerts[0].message).toContain('nivel 1 de 2');

    await paymentOrdersService.decideApproval(company.id, order.id, level1Approver.id, { decision: 'APPROVED', comment: null });

    alerts = await alertsForOrder(company.id, order.id);
    expect(alerts).toHaveLength(2);
    const level1Alert = alerts.find((a) => a.entityId.endsWith(':level:1'));
    const level2Alert = alerts.find((a) => a.entityId.endsWith(':level:2'));
    expect(level1Alert.status).toBe('ACKNOWLEDGED');
    expect(level2Alert.status).toBe('ACTIVE');

    await paymentOrdersService.decideApproval(company.id, order.id, level2Approver.id, {
      decision: 'REJECTED',
      comment: 'Rechazado en la prueba',
    });

    alerts = await alertsForOrder(company.id, order.id);
    expect(alerts.every((a) => a.status === 'ACKNOWLEDGED')).toBe(true);

    const updatedOrder = await prisma.paymentOrder.findUnique({ where: { id: order.id } });
    expect(updatedOrder.status).toBe('REJECTED');
  });

  test('completar todos los niveles (APPROVED) también cierra las alertas de la orden', async () => {
    const { company, requester, level1Approver, level2Approver, treasuryAccount, expenseAccount } = scenario;

    const order = await paymentOrdersService.createPaymentOrder(company.id, requester.id, {
      treasuryAccountId: treasuryAccount.id,
      glAccountId: expenseAccount.id,
      payeeName: 'Proveedor de prueba 2',
      amount: 500,
      currency: 'USD',
      description: 'Pago de prueba F11 (completo)',
      scheduledDate: new Date(),
    });

    await paymentOrdersService.submitForApproval(company.id, order.id, requester.id);
    await paymentOrdersService.decideApproval(company.id, order.id, level1Approver.id, { decision: 'APPROVED', comment: null });
    await paymentOrdersService.decideApproval(company.id, order.id, level2Approver.id, { decision: 'APPROVED', comment: null });

    const alerts = await alertsForOrder(company.id, order.id);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.every((a) => a.status === 'ACKNOWLEDGED')).toBe(true);

    const updatedOrder = await prisma.paymentOrder.findUnique({ where: { id: order.id } });
    expect(updatedOrder.status).toBe('APPROVED');
  });

  test('cancelar una orden pendiente también cierra su alerta activa', async () => {
    const { company, requester, treasuryAccount, expenseAccount } = scenario;

    const order = await paymentOrdersService.createPaymentOrder(company.id, requester.id, {
      treasuryAccountId: treasuryAccount.id,
      glAccountId: expenseAccount.id,
      payeeName: 'Proveedor de prueba 3',
      amount: 200,
      currency: 'USD',
      description: 'Pago de prueba F11 (cancelado)',
      scheduledDate: new Date(),
    });

    await paymentOrdersService.submitForApproval(company.id, order.id, requester.id);
    let alerts = await alertsForOrder(company.id, order.id);
    expect(alerts.some((a) => a.status === 'ACTIVE')).toBe(true);

    await paymentOrdersService.cancelPaymentOrder(company.id, order.id, requester.id);

    alerts = await alertsForOrder(company.id, order.id);
    expect(alerts.every((a) => a.status === 'ACKNOWLEDGED')).toBe(true);
  });

  test('un re-escaneo/reintento no debe duplicar la alerta del mismo nivel (createAlertIfNotExists)', async () => {
    const { company, treasuryAccount } = scenario;
    // Prueba directa del motor genérico: dos llamadas seguidas con el
    // mismo entityId nunca crean dos alertas activas — mismo criterio
    // ya usado por el resto de escaneos del proyecto.
    const entityId = 'orden-ficticia:level:1';
    await alertsService.createAlertIfNotExists({
      companyId: company.id,
      type: 'APPROVAL_PENDING',
      severity: 'WARNING',
      message: 'Prueba',
      entityType: 'PaymentOrder',
      entityId,
    });
    await alertsService.createAlertIfNotExists({
      companyId: company.id,
      type: 'APPROVAL_PENDING',
      severity: 'WARNING',
      message: 'Prueba',
      entityType: 'PaymentOrder',
      entityId,
    });
    const alerts = await prisma.alert.findMany({ where: { companyId: company.id, entityType: 'PaymentOrder', entityId } });
    expect(alerts).toHaveLength(1);
    void treasuryAccount;
  });
});
