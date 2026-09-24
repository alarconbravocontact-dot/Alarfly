// Fase 9 (Centro Operativo): pruebas obligatorias del Dashboard Read
// Layer contra Postgres real — RBAC por widget (sección 12/40: la API
// debe proteger los datos, no solo el frontend), multiempresa, no
// mutación (sección 47: GET /dashboard nunca escribe nada), coherencia
// de los 2 widgets nuevos (finance_summary/liquidity_forecast) contra
// su propia fuente, y el ciclo completo de preferencias (mostrar/
// ocultar/reordenar/restaurar).
const {
  prisma,
  createCompany,
  createUser,
  createAccount,
  createOpenPeriod,
  createTreasuryAccount,
  createTaxJurisdiction,
  createCustomer,
  setReceivableAccount,
  cleanupCompany,
} = require('../../../test-helpers/integration-fixtures');
const dashboardService = require('./dashboard.service');
const financeSummaryService = require('../../finance/services/finance-summary.service');
const liquidityForecastService = require('../../treasury/services/liquidity-forecast.service');
const arInvoicesService = require('../../accounts-receivable/services/ar-invoices.service');

let scenario;

// Rango real para los widgets que sí lo necesitan (ebitda/burn_rate_runway) —
// mismo criterio ya usado en Fase 8: `{}` sin from/to hace explotar
// `kpisService.getBurnRateAndRunway` con fechas `undefined`.
function currentRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { from, to, asOfDate: to };
}

async function buildScenario(role = 'ADMIN') {
  const company = await createCompany();
  const user = await createUser(company.id, role);
  const bankGlAccount = await createAccount(company.id, { type: 'ASSET', normalBalance: 'DEBIT' });
  const receivableGlAccount = await createAccount(company.id, { type: 'ASSET', normalBalance: 'DEBIT' });
  const incomeAccount = await createAccount(company.id, { type: 'INCOME', normalBalance: 'CREDIT' });
  await createOpenPeriod(company.id);
  await setReceivableAccount(company.id, receivableGlAccount.id);
  await createTreasuryAccount(company.id, bankGlAccount.id, 500);
  const customer = await createCustomer(company.id);
  const jurisdiction = await createTaxJurisdiction(company.id);
  return { company, user, receivableGlAccount, incomeAccount, customer, jurisdiction };
}

afterEach(async () => {
  if (scenario) await cleanupCompany(scenario.company.id);
  scenario = null;
});

afterAll(async () => {
  await prisma.$disconnect();
});

const SENSITIVE_KEYS = ['cash_position', 'ebitda', 'burn_rate_runway', 'income_statement_summary', 'balance_sheet_summary', 'finance_summary', 'liquidity_forecast'];

describe('RBAC por widget (secciones 12/40): la API filtra, no solo el frontend', () => {
  test('un Colaborador nunca recibe los widgets financieros/fiscales sensibles, ni en el catálogo ni en el Dashboard', async () => {
    scenario = await buildScenario('COLLABORATOR');

    const catalog = dashboardService.listAvailableWidgets('COLLABORATOR');
    const catalogKeys = catalog.map((w) => w.key);
    for (const key of SENSITIVE_KEYS) expect(catalogKeys).not.toContain(key);
    expect(catalogKeys).toContain('active_alerts');

    const preferences = await dashboardService.getWidgetPreferences(scenario.company.id, scenario.user.id, 'COLLABORATOR');
    const prefKeys = preferences.map((p) => p.widgetKey);
    for (const key of SENSITIVE_KEYS) expect(prefKeys).not.toContain(key);

    const dashboard = await dashboardService.getDashboard(scenario.company.id, scenario.user.id, 'COLLABORATOR', {});
    const widgetKeys = dashboard.widgets.map((w) => w.widgetKey);
    for (const key of SENSITIVE_KEYS) expect(widgetKeys).not.toContain(key);
  });

  test('un Administrador sí recibe todos los widgets, incluidos los nuevos de Fase 9', async () => {
    scenario = await buildScenario('ADMIN');
    const catalogKeys = dashboardService.listAvailableWidgets('ADMIN').map((w) => w.key);
    for (const key of [...SENSITIVE_KEYS, 'active_alerts']) expect(catalogKeys).toContain(key);
  });

  test('intentar configurar un widget que el rol no puede ver se rechaza (WIDGET_NOT_FOUND), no solo se ignora', async () => {
    scenario = await buildScenario('COLLABORATOR');
    await expect(
      dashboardService.setWidgetPreference(scenario.company.id, scenario.user.id, 'COLLABORATOR', 'ebitda', { isVisible: true })
    ).rejects.toMatchObject({ code: 'WIDGET_NOT_FOUND' });
  });

  test('un Contador ve widgets de Contabilidad pero no los de FP&A (EBITDA/Burn Rate)', async () => {
    scenario = await buildScenario('ACCOUNTANT');
    const catalogKeys = dashboardService.listAvailableWidgets('ACCOUNTANT').map((w) => w.key);
    expect(catalogKeys).toContain('cash_position');
    expect(catalogKeys).toContain('finance_summary');
    expect(catalogKeys).not.toContain('ebitda');
    expect(catalogKeys).not.toContain('burn_rate_runway');
  });
});

describe('Test multiempresa (sección 39): el Dashboard de una empresa nunca incluye datos de otra', () => {
  test('finance_summary de la empresa A nunca refleja las ventas de la empresa B', async () => {
    const scenarioA = await buildScenario('ADMIN');
    const scenarioB = await buildScenario('ADMIN');
    try {
      await arInvoicesService.createInvoice(scenarioA.company.id, scenarioA.user.id, {
        customerId: scenarioA.customer.id,
        jurisdictionId: scenarioA.jurisdiction.id,
        incomeAccountId: scenarioA.incomeAccount.id,
        issueDate: new Date(),
        lines: [{ description: 'Venta A', quantity: 1, unitPrice: 700 }],
      });
      await arInvoicesService.createInvoice(scenarioB.company.id, scenarioB.user.id, {
        customerId: scenarioB.customer.id,
        jurisdictionId: scenarioB.jurisdiction.id,
        incomeAccountId: scenarioB.incomeAccount.id,
        issueDate: new Date(),
        lines: [{ description: 'Venta B', quantity: 1, unitPrice: 120 }],
      });

      const dashboardA = await dashboardService.getDashboard(scenarioA.company.id, scenarioA.user.id, 'ADMIN', currentRange());
      const dashboardB = await dashboardService.getDashboard(scenarioB.company.id, scenarioB.user.id, 'ADMIN', currentRange());
      const financeA = dashboardA.widgets.find((w) => w.widgetKey === 'finance_summary').data;
      const financeB = dashboardB.widgets.find((w) => w.widgetKey === 'finance_summary').data;

      expect(Number(financeA.totalReceivable)).toBe(700);
      expect(Number(financeB.totalReceivable)).toBe(120);
    } finally {
      await cleanupCompany(scenarioA.company.id);
      await cleanupCompany(scenarioB.company.id);
    }
  });
});

describe('Test de no mutación (sección 47): GET /dashboard es estrictamente de solo lectura', () => {
  test('pedir el Dashboard varias veces seguidas no crea ni modifica ningún asiento, factura o saldo', async () => {
    scenario = await buildScenario('ADMIN');
    await arInvoicesService.createInvoice(scenario.company.id, scenario.user.id, {
      customerId: scenario.customer.id,
      jurisdictionId: scenario.jurisdiction.id,
      incomeAccountId: scenario.incomeAccount.id,
      issueDate: new Date(),
      lines: [{ description: 'Venta base', quantity: 1, unitPrice: 250 }],
    });

    const journalEntriesBefore = await prisma.journalEntry.count({ where: { companyId: scenario.company.id } });
    const invoicesBefore = await prisma.arInvoice.count({ where: { companyId: scenario.company.id } });
    const alertsBefore = await prisma.alert.count({ where: { companyId: scenario.company.id } });
    const treasuryBalanceBefore = (await prisma.treasuryAccount.findFirst({ where: { companyId: scenario.company.id } })).currentBalance;

    // 3 lecturas seguidas del Dashboard completo — nunca debería
    // "acumular" ningún efecto por leerlo repetidas veces.
    await dashboardService.getDashboard(scenario.company.id, scenario.user.id, 'ADMIN', currentRange());
    await dashboardService.getDashboard(scenario.company.id, scenario.user.id, 'ADMIN', currentRange());
    await dashboardService.getDashboard(scenario.company.id, scenario.user.id, 'ADMIN', currentRange());

    const journalEntriesAfter = await prisma.journalEntry.count({ where: { companyId: scenario.company.id } });
    const invoicesAfter = await prisma.arInvoice.count({ where: { companyId: scenario.company.id } });
    const alertsAfter = await prisma.alert.count({ where: { companyId: scenario.company.id } });
    const treasuryBalanceAfter = (await prisma.treasuryAccount.findFirst({ where: { companyId: scenario.company.id } })).currentBalance;

    expect(journalEntriesAfter).toBe(journalEntriesBefore);
    expect(invoicesAfter).toBe(invoicesBefore);
    expect(alertsAfter).toBe(alertsBefore);
    expect(String(treasuryBalanceAfter)).toBe(String(treasuryBalanceBefore));
  });
});

describe('Coherencia de los widgets nuevos (Fase 9): mismo número que su servicio de origen', () => {
  test('el widget finance_summary es exactamente lo que devuelve finance-summary.service, sin recalcular nada', async () => {
    scenario = await buildScenario('ADMIN');
    await arInvoicesService.createInvoice(scenario.company.id, scenario.user.id, {
      customerId: scenario.customer.id,
      jurisdictionId: scenario.jurisdiction.id,
      incomeAccountId: scenario.incomeAccount.id,
      issueDate: new Date(),
      lines: [{ description: 'Venta', quantity: 1, unitPrice: 333 }],
    });

    const direct = await financeSummaryService.getFinanceSummary(scenario.company.id);
    const dashboard = await dashboardService.getDashboard(scenario.company.id, scenario.user.id, 'ADMIN', currentRange());
    const widget = dashboard.widgets.find((w) => w.widgetKey === 'finance_summary');

    expect(widget.data.cashOnHand).toBe(direct.cashOnHand);
    expect(widget.data.totalReceivable).toBe(direct.totalReceivable);
    expect(widget.data.overdueReceivable).toBe(direct.overdueReceivable);
  });

  test('el widget liquidity_forecast es exactamente lo que devuelve liquidity-forecast.service, sin un segundo forecast', async () => {
    scenario = await buildScenario('ADMIN');
    const direct = await liquidityForecastService.getLiquidityForecast(scenario.company.id, { weeks: 8 });
    const dashboard = await dashboardService.getDashboard(scenario.company.id, scenario.user.id, 'ADMIN', currentRange());
    const widget = dashboard.widgets.find((w) => w.widgetKey === 'liquidity_forecast');

    expect(widget.data.startingBalance).toBe(direct.startingBalance);
    expect(widget.data.weeks.length).toBe(direct.weeks.length);
    expect(widget.data.weeks[0].projectedBalance).toBe(direct.weeks[0].projectedBalance);
  });
});

describe('Preferencias del Dashboard (secciones 10/11/38): mostrar/ocultar, orden y restaurar', () => {
  test('ocultar un widget lo saca del Dashboard, y restaurar la configuración lo vuelve a traer visible por defecto', async () => {
    scenario = await buildScenario('ADMIN');

    await dashboardService.setWidgetPreference(scenario.company.id, scenario.user.id, 'ADMIN', 'ebitda', { isVisible: false });
    let dashboard = await dashboardService.getDashboard(scenario.company.id, scenario.user.id, 'ADMIN', currentRange());
    expect(dashboard.widgets.map((w) => w.widgetKey)).not.toContain('ebitda');

    await dashboardService.resetWidgetPreferences(scenario.user.id);
    dashboard = await dashboardService.getDashboard(scenario.company.id, scenario.user.id, 'ADMIN', currentRange());
    expect(dashboard.widgets.map((w) => w.widgetKey)).toContain('ebitda');
  });

  test('restaurar la configuración nunca borra datos de la empresa (facturas/asientos siguen intactos)', async () => {
    scenario = await buildScenario('ADMIN');
    await arInvoicesService.createInvoice(scenario.company.id, scenario.user.id, {
      customerId: scenario.customer.id,
      jurisdictionId: scenario.jurisdiction.id,
      incomeAccountId: scenario.incomeAccount.id,
      issueDate: new Date(),
      lines: [{ description: 'Venta', quantity: 1, unitPrice: 90 }],
    });
    const invoicesBefore = await prisma.arInvoice.count({ where: { companyId: scenario.company.id } });

    await dashboardService.setWidgetPreference(scenario.company.id, scenario.user.id, 'ADMIN', 'cash_position', { isVisible: false, order: 3 });
    await dashboardService.resetWidgetPreferences(scenario.user.id);

    const invoicesAfter = await prisma.arInvoice.count({ where: { companyId: scenario.company.id } });
    expect(invoicesAfter).toBe(invoicesBefore);

    const remainingPrefs = await prisma.dashboardWidgetPreference.count({ where: { userId: scenario.user.id } });
    expect(remainingPrefs).toBe(0);
  });

  test('reordenar widgets (mover uno a otra posición) persiste en getWidgetPreferences', async () => {
    scenario = await buildScenario('ADMIN');
    // active_alerts es el último del catálogo por defecto (último en
    // declararse en WIDGET_DEFINITIONS) — moverlo a orden -1 debe
    // dejarlo antes que CUALQUIER otro widget, incluido ebitda.
    await dashboardService.setWidgetPreference(scenario.company.id, scenario.user.id, 'ADMIN', 'active_alerts', { order: -1 });

    const prefs = await dashboardService.getWidgetPreferences(scenario.company.id, scenario.user.id, 'ADMIN');
    const alertsIndex = prefs.findIndex((p) => p.widgetKey === 'active_alerts');
    const ebitdaIndex = prefs.findIndex((p) => p.widgetKey === 'ebitda');
    expect(alertsIndex).toBe(0);
    expect(alertsIndex).toBeLessThan(ebitdaIndex);
  });
});
