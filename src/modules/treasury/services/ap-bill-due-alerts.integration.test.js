// F12-A (Automatización Determinística), punto 7: "cuentas por pagar
// próximas a vencer" no tenía ninguna alerta — ningún ApBill generaba
// aviso de vencimiento, a diferencia de Órdenes de Pago y Cuotas de
// Deuda, que ya lo hacían bajo el mismo tipo PAYMENT_DUE_SOON. Estas
// pruebas cubren contra Postgres real: condición positiva (por
// vencer), overdue (ya vencida, severidad CRITICAL), condición
// negativa (lejos de vencer), borde (factura ya pagada, excluida),
// idempotencia (re-escaneo no duplica) y aislamiento multiempresa.
const {
  prisma,
  buildPurchaseScenario,
  cleanupCompany,
} = require('../../../test-helpers/integration-fixtures');
const apBillsService = require('../../accounts-payable/services/ap-bills.service');
const treasuryAlertsService = require('./alerts.service');
const coreAlertsService = require('../../../core/alerts/alerts.service');

let scenario;

async function createBillDueOn(dueDate) {
  const { company, user, vendor, jurisdiction, expenseAccount } = scenario;
  const bill = await apBillsService.createBill(company.id, user.id, {
    vendorId: vendor.id,
    jurisdictionId: jurisdiction.id,
    expenseAccountId: expenseAccount.id,
    issueDate: new Date(),
    lines: [{ description: 'Servicio de prueba F12-A', quantity: 1, unitPrice: 100 }],
  });
  await prisma.apBill.update({ where: { id: bill.id }, data: { dueDate } });
  return bill;
}

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function apBillAlerts(companyId, billId) {
  return prisma.alert.findMany({ where: { companyId, type: 'PAYMENT_DUE_SOON', entityType: 'ApBill', entityId: billId } });
}

beforeEach(async () => {
  scenario = await buildPurchaseScenario();
  await coreAlertsService.createRule(scenario.company.id, scenario.user.id, {
    name: 'Pagos por vencer (prueba F12-A)',
    type: 'PAYMENT_DUE_SOON',
    isActive: true,
    parameters: { daysBefore: 3 },
  });
});

afterEach(async () => {
  await prisma.alert.deleteMany({ where: { companyId: scenario.company.id } });
  await cleanupCompany(scenario.company.id);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Alertas de vencimiento de Cuentas por Pagar (F12-A)', () => {
  test('factura de compra que vence dentro del umbral genera PAYMENT_DUE_SOON en WARNING', async () => {
    const { company } = scenario;
    const bill = await createBillDueOn(daysFromNow(2));

    const result = await treasuryAlertsService.runAlertsScan(company.id);
    expect(result.paymentsDueSoon.some((a) => a.entityId === bill.id)).toBe(true);

    const alerts = await apBillAlerts(company.id, bill.id);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('WARNING');
    expect(alerts[0].message).toContain(String(bill.billNumber));
    expect(alerts[0].message).toContain(scenario.vendor.name);
  });

  test('factura de compra ya vencida genera la alerta en severidad CRITICAL', async () => {
    const { company } = scenario;
    const bill = await createBillDueOn(daysFromNow(-5));

    await treasuryAlertsService.runAlertsScan(company.id);

    const alerts = await apBillAlerts(company.id, bill.id);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe('CRITICAL');
  });

  test('factura de compra lejos de vencer no genera ninguna alerta', async () => {
    const { company } = scenario;
    const bill = await createBillDueOn(daysFromNow(30));

    await treasuryAlertsService.runAlertsScan(company.id);

    const alerts = await apBillAlerts(company.id, bill.id);
    expect(alerts).toHaveLength(0);
  });

  test('una factura ya pagada por completo, aunque su fecha luzca "vencida", queda excluida del escaneo', async () => {
    // El escaneo filtra por `status: { in: ['OPEN', 'PARTIALLY_PAID'] } }`
    // — se fuerza el estado PAID directo (sin correr el flujo completo
    // de pago, que ya tiene su propia cobertura en
    // purchases-ap.integration.test.js) para probar específicamente ese
    // filtro del escaneo, no el motor de pagos.
    const { company } = scenario;
    const bill = await createBillDueOn(daysFromNow(-3));
    await prisma.apBill.update({ where: { id: bill.id }, data: { status: 'PAID', paidAmount: bill.totalAmount } });

    await treasuryAlertsService.runAlertsScan(company.id);

    const alerts = await apBillAlerts(company.id, bill.id);
    expect(alerts).toHaveLength(0);
  });

  test('re-escanear dos veces seguidas no duplica la alerta (idempotencia)', async () => {
    const { company } = scenario;
    const bill = await createBillDueOn(daysFromNow(0));

    await treasuryAlertsService.runAlertsScan(company.id);
    await treasuryAlertsService.runAlertsScan(company.id);

    const alerts = await apBillAlerts(company.id, bill.id);
    expect(alerts).toHaveLength(1);
  });

  test('aislamiento multiempresa: una factura vencida de otra empresa nunca aparece en el escaneo de esta', async () => {
    const otherScenario = await buildPurchaseScenario();
    try {
      await coreAlertsService.createRule(otherScenario.company.id, otherScenario.user.id, {
        name: 'Pagos por vencer (prueba F12-A, otra empresa)',
        type: 'PAYMENT_DUE_SOON',
        isActive: true,
        parameters: { daysBefore: 3 },
      });
      const otherBill = await apBillsService.createBill(otherScenario.company.id, otherScenario.user.id, {
        vendorId: otherScenario.vendor.id,
        jurisdictionId: otherScenario.jurisdiction.id,
        expenseAccountId: otherScenario.expenseAccount.id,
        issueDate: new Date(),
        lines: [{ description: 'Servicio de prueba (otra empresa)', quantity: 1, unitPrice: 50 }],
      });
      await prisma.apBill.update({ where: { id: otherBill.id }, data: { dueDate: daysFromNow(-2) } });

      const result = await treasuryAlertsService.runAlertsScan(scenario.company.id);
      expect(result.paymentsDueSoon.some((a) => a.entityId === otherBill.id)).toBe(false);

      const crossCompanyAlerts = await prisma.alert.findMany({
        where: { companyId: scenario.company.id, type: 'PAYMENT_DUE_SOON', entityType: 'ApBill', entityId: otherBill.id },
      });
      expect(crossCompanyAlerts).toHaveLength(0);
    } finally {
      await prisma.alert.deleteMany({ where: { companyId: otherScenario.company.id } });
      await cleanupCompany(otherScenario.company.id);
    }
  });

  test('sin ninguna regla PAYMENT_DUE_SOON activa, el escaneo no genera ninguna alerta de este tipo', async () => {
    const { company } = scenario;
    await prisma.alertRule.updateMany({ where: { companyId: company.id, type: 'PAYMENT_DUE_SOON' }, data: { isActive: false } });
    await createBillDueOn(daysFromNow(-1));

    const result = await treasuryAlertsService.runAlertsScan(company.id);
    expect(result.paymentsDueSoon).toHaveLength(0);
  });
});
