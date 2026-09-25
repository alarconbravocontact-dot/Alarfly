// Fase 12: prueba de integración contra Postgres real — confirma que
// `insights.service` arma sus insights a partir de datos REALES creados
// con los motores de siempre (nunca insertados a mano en la tabla de
// insights, porque no existe tal tabla — sección 35), y que el
// aislamiento multiempresa se mantiene.
const { prisma, buildSalesScenario, cleanupCompany } = require('../../../test-helpers/integration-fixtures');
const arInvoicesService = require('../../accounts-receivable/services/ar-invoices.service');
const insightsService = require('./insights.service');

let scenario;

afterEach(async () => {
  if (scenario) await cleanupCompany(scenario.company.id);
  scenario = null;
});

afterAll(async () => {
  await prisma.$disconnect();
});

function inDays(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

describe('insights.service — Fase 12 (Postgres real)', () => {
  test('getLiquidityInsight es null cuando no hay riesgo de liquidez detectado', async () => {
    scenario = await buildSalesScenario();
    const insight = await insightsService.getLiquidityInsight(scenario.company.id);
    expect(insight).toBeNull();
  });

  test('getCollectionsInsight es null cuando no hay ninguna factura vencida', async () => {
    scenario = await buildSalesScenario();
    const insight = await insightsService.getCollectionsInsight(scenario.company.id);
    expect(insight).toBeNull();
  });

  test('getCollectionsInsight detecta una factura real vencida, con evidencia trazable a AR', async () => {
    scenario = await buildSalesScenario();
    const { company, user, customer, jurisdiction, serviceVariant, incomeAccount } = scenario;

    const invoice = await arInvoicesService.createInvoice(company.id, user.id, {
      customerId: customer.id,
      jurisdictionId: jurisdiction.id,
      incomeAccountId: incomeAccount.id,
      issueDate: new Date(),
      lines: [{ description: 'Servicio de consultoría', quantity: 1, unitPrice: 800, variantId: serviceVariant.id }],
    });
    // Backdatea el vencimiento para simular una factura real ya vencida
    // (mismo criterio ya usado en la línea de tiempo de AR: el evento de
    // negocio real es lo que se ajusta, no un dato inventado aparte).
    await prisma.arInvoice.update({ where: { id: invoice.id }, data: { dueDate: inDays(-45) } });

    const insight = await insightsService.getCollectionsInsight(company.id);
    expect(insight).not.toBeNull();
    expect(insight.type).toBe('collections');
    expect(insight.evidence).toHaveLength(1);
    expect(insight.evidence[0].name).toBe(customer.name);
    expect(insight.evidence[0].severity).toBe('WARNING'); // bucket DAYS_31_60
    expect(insight.description).toContain('1 cliente(s)');
  });

  test('aislamiento multiempresa: la factura vencida de una empresa nunca aparece en el insight de otra', async () => {
    scenario = await buildSalesScenario();
    const otherScenario = await buildSalesScenario();
    const { company, user, customer, jurisdiction, serviceVariant, incomeAccount } = scenario;

    const invoice = await arInvoicesService.createInvoice(company.id, user.id, {
      customerId: customer.id,
      jurisdictionId: jurisdiction.id,
      incomeAccountId: incomeAccount.id,
      issueDate: new Date(),
      lines: [{ description: 'Servicio', quantity: 1, unitPrice: 300, variantId: serviceVariant.id }],
    });
    await prisma.arInvoice.update({ where: { id: invoice.id }, data: { dueDate: inDays(-10) } });

    const ownInsight = await insightsService.getCollectionsInsight(company.id);
    const otherInsight = await insightsService.getCollectionsInsight(otherScenario.company.id);

    expect(ownInsight).not.toBeNull();
    expect(otherInsight).toBeNull();

    await cleanupCompany(otherScenario.company.id);
  });
});
