// Fase 12 (sección 10/34, "Evento → Detector → Insight → Alerta"):
// prueba contra Postgres real que `insightsService.scanLiquidityRisk`
// crea una alerta real cuando hay riesgo de liquidez detectado, nunca
// duplica una ya activa, y no crea nada cuando no hay riesgo.
const { prisma, buildSalesScenario, createAccount, cleanupCompany } = require('../../../test-helpers/integration-fixtures');
const debtsService = require('../../treasury/services/debts.service');
const insightsService = require('./insights.service');

let scenario;

afterEach(async () => {
  if (scenario) {
    await prisma.alert.deleteMany({ where: { companyId: scenario.company.id } });
    await cleanupCompany(scenario.company.id);
  }
  scenario = null;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('insights.service.scanLiquidityRisk — Fase 12 (Postgres real)', () => {
  test('no crea ninguna alerta cuando no hay riesgo de liquidez', async () => {
    scenario = await buildSalesScenario();
    const created = await insightsService.scanLiquidityRisk(scenario.company.id);
    expect(created).toHaveLength(0);
  });

  test('crea una alerta LIQUIDITY_RISK_FORECAST real cuando la Previsión de Liquidez proyecta un saldo negativo, y no la duplica en un segundo escaneo', async () => {
    scenario = await buildSalesScenario();
    const { company, treasuryAccount } = scenario;

    // Fuerza una salida grande y próxima (deuda desembolsada + cuota
    // inmediata) para que la Previsión de Liquidez real (sin mockear)
    // proyecte una semana negativa — mismo mecanismo que ya usa
    // liquidity-forecast.service, no se inventa un forecast aparte.
    const liabilityAccount = await createAccount(company.id, { type: 'LIABILITY', normalBalance: 'CREDIT' });
    const interestExpenseAccount = await createAccount(company.id, { type: 'EXPENSE', normalBalance: 'DEBIT' });
    const debt = await debtsService.createDebt(company.id, scenario.user.id, {
      type: 'LOAN',
      name: 'Préstamo de riesgo de liquidez',
      lender: 'Banco de prueba',
      principalAmount: 999999,
      interestRate: 5,
      currency: 'USD',
      startDate: new Date(),
      installmentCount: 1,
      treasuryAccountId: treasuryAccount.id,
      liabilityAccountId: liabilityAccount.id,
      interestExpenseAccountId: interestExpenseAccount.id,
    });
    await debtsService.disburseLoan(company.id, debt.id, scenario.user.id);

    const created = await insightsService.scanLiquidityRisk(company.id);
    expect(created).toHaveLength(1);
    expect(created[0].type).toBe('LIQUIDITY_RISK_FORECAST');
    expect(created[0].entityType).toBe('Company');
    expect(created[0].entityId).toBe(company.id);
    expect(created[0].status).toBe('ACTIVE');

    const secondScan = await insightsService.scanLiquidityRisk(company.id);
    expect(secondScan).toHaveLength(0);

    const alertsInDb = await prisma.alert.findMany({ where: { companyId: company.id, type: 'LIQUIDITY_RISK_FORECAST' } });
    expect(alertsInDb).toHaveLength(1);
  });
});
