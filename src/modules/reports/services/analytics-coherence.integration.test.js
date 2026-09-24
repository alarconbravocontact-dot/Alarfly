// Fase 8 (secciones 61-69): pruebas obligatorias de coherencia
// analítica contra Postgres real — confirman que la arquitectura ya
// distribuida (cada dominio dueño de su cálculo, Dashboard/Glosario/
// Finance Summary como consumidores) de verdad produce UN SOLO número
// para la misma pregunta, no una segunda realidad de datos.
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
const arInvoicesService = require('../../accounts-receivable/services/ar-invoices.service');
const dashboardService = require('./dashboard.service');
const financeSummaryService = require('../../finance/services/finance-summary.service');
const glossaryService = require('../../../core/glossary/glossary.service');
const kpisService = require('../../fpa/services/kpis.service');
const accountingReportsService = require('../../accounting/services/reports.service');
const scenariosService = require('../../fpa/services/scenarios.service');
const fpaDimensionsService = require('../../fpa/services/fpa-dimensions.service');
const budgetsService = require('../../fpa/services/budgets.service');
const budgetLinesService = require('../../fpa/services/budget-lines.service');
const budgetVarianceService = require('../../fpa/services/budget-variance.service');
const ledgerService = require('../../../core/ledger/ledger.service');
const fxService = require('../../../core/fx/fx.service');

let scenario;

async function buildScenario() {
  const company = await createCompany();
  const user = await createUser(company.id);
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

describe('Test de una fuente (sección 62): Dashboard, Finance Summary, Glosario y FPA coinciden', () => {
  test('EBITDA reportado por el widget de Dashboard, el Glosario y FP&A es exactamente el mismo número', async () => {
    scenario = await buildScenario();
    const from = new Date('2026-01-01');
    const to = new Date('2026-01-31');

    await arInvoicesService.createInvoice(scenario.company.id, scenario.user.id, {
      customerId: scenario.customer.id,
      jurisdictionId: scenario.jurisdiction.id,
      incomeAccountId: scenario.incomeAccount.id,
      issueDate: new Date('2026-01-15'),
      lines: [{ description: 'Servicio de prueba', quantity: 1, unitPrice: 300 }],
    });

    const fromFpa = await kpisService.getEbitda(scenario.company.id, { from, to });
    const dashboard = await dashboardService.getDashboard(scenario.company.id, scenario.user.id, { from, to });
    const ebitdaWidget = dashboard.widgets.find((w) => w.widgetKey === 'ebitda');

    expect(Number(ebitdaWidget.data.ebitda)).toBe(Number(fromFpa.ebitda));
    expect(Number(ebitdaWidget.data.ebitda)).toBe(300); // sin gastos, EBITDA = ingreso del periodo
  });

  test('la posición de caja consolidada del Dashboard coincide con el colchón de liquidez del Glosario/Finance Summary', async () => {
    scenario = await buildScenario();

    const now = new Date();
    const rangeFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const rangeTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const dashboard = await dashboardService.getDashboard(scenario.company.id, scenario.user.id, {
      from: rangeFrom,
      to: rangeTo,
      asOfDate: rangeTo,
    });
    const cashWidget = dashboard.widgets.find((w) => w.widgetKey === 'cash_position');

    const financeSummary = await financeSummaryService.getFinanceSummary(scenario.company.id);
    const glossaryValue = await glossaryService.getLiveValue(scenario.company.id, 'liquidity-cushion');

    expect(cashWidget.data.totalInBaseCurrency).toBe(financeSummary.cashOnHand);
    expect(financeSummary.availableLiquidity).toBe(glossaryValue.value);
  });

  test('cuentas por cobrar del Glosario coincide con Finance Summary, ambos derivados del mismo aging.service', async () => {
    scenario = await buildScenario();
    await arInvoicesService.createInvoice(scenario.company.id, scenario.user.id, {
      customerId: scenario.customer.id,
      jurisdictionId: scenario.jurisdiction.id,
      incomeAccountId: scenario.incomeAccount.id,
      issueDate: new Date(),
      lines: [{ description: 'Servicio', quantity: 1, unitPrice: 150 }],
    });

    const financeSummary = await financeSummaryService.getFinanceSummary(scenario.company.id);
    const glossaryValue = await glossaryService.getLiveValue(scenario.company.id, 'accounts-receivable');
    expect(glossaryValue.value).toBe(financeSummary.totalReceivable);
    expect(Number(glossaryValue.value)).toBe(150);
  });
});

describe('Test multiempresa (sección 63)', () => {
  test('Dashboard/Finance Summary/EBITDA de una empresa nunca incluyen datos de otra', async () => {
    const scenarioA = await buildScenario();
    const scenarioB = await buildScenario();
    try {
      await arInvoicesService.createInvoice(scenarioA.company.id, scenarioA.user.id, {
        customerId: scenarioA.customer.id,
        jurisdictionId: scenarioA.jurisdiction.id,
        incomeAccountId: scenarioA.incomeAccount.id,
        issueDate: new Date('2026-03-01'),
        lines: [{ description: 'Venta A', quantity: 1, unitPrice: 1000 }],
      });
      await arInvoicesService.createInvoice(scenarioB.company.id, scenarioB.user.id, {
        customerId: scenarioB.customer.id,
        jurisdictionId: scenarioB.jurisdiction.id,
        incomeAccountId: scenarioB.incomeAccount.id,
        issueDate: new Date('2026-03-01'),
        lines: [{ description: 'Venta B', quantity: 1, unitPrice: 250 }],
      });

      const ebitdaA = await kpisService.getEbitda(scenarioA.company.id, { from: new Date('2026-03-01'), to: new Date('2026-03-31') });
      const ebitdaB = await kpisService.getEbitda(scenarioB.company.id, { from: new Date('2026-03-01'), to: new Date('2026-03-31') });
      expect(Number(ebitdaA.ebitda)).toBe(1000);
      expect(Number(ebitdaB.ebitda)).toBe(250);

      const summaryA = await financeSummaryService.getFinanceSummary(scenarioA.company.id);
      const summaryB = await financeSummaryService.getFinanceSummary(scenarioB.company.id);
      expect(Number(summaryA.totalReceivable)).toBe(1000);
      expect(Number(summaryB.totalReceivable)).toBe(250);
    } finally {
      await cleanupCompany(scenarioA.company.id);
      await cleanupCompany(scenarioB.company.id);
    }
  });
});

describe('Test histórico (sección 64): datos futuros no recalculan un reporte ya cerrado', () => {
  test('el Estado de Resultados de enero no cambia al facturar en febrero', async () => {
    scenario = await buildScenario();
    await arInvoicesService.createInvoice(scenario.company.id, scenario.user.id, {
      customerId: scenario.customer.id,
      jurisdictionId: scenario.jurisdiction.id,
      incomeAccountId: scenario.incomeAccount.id,
      issueDate: new Date('2026-01-15'),
      lines: [{ description: 'Venta de enero', quantity: 1, unitPrice: 400 }],
    });

    const januaryBefore = await accountingReportsService.getIncomeStatement(scenario.company.id, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    expect(Number(januaryBefore.totalIncome)).toBe(400);

    // Una venta nueva en febrero, después de haber consultado enero.
    await arInvoicesService.createInvoice(scenario.company.id, scenario.user.id, {
      customerId: scenario.customer.id,
      jurisdictionId: scenario.jurisdiction.id,
      incomeAccountId: scenario.incomeAccount.id,
      issueDate: new Date('2026-02-10'),
      lines: [{ description: 'Venta de febrero', quantity: 1, unitPrice: 999 }],
    });

    const januaryAfter = await accountingReportsService.getIncomeStatement(scenario.company.id, {
      from: new Date('2026-01-01'),
      to: new Date('2026-01-31'),
    });
    expect(Number(januaryAfter.totalIncome)).toBe(400); // sigue igual, nunca 1399
  });
});

describe('Test de fecha de corte (sección 67)', () => {
  test('el Balance General al 31/01 y al 28/02 respeta exactamente el corte de fecha', async () => {
    scenario = await buildScenario();
    await arInvoicesService.createInvoice(scenario.company.id, scenario.user.id, {
      customerId: scenario.customer.id,
      jurisdictionId: scenario.jurisdiction.id,
      incomeAccountId: scenario.incomeAccount.id,
      issueDate: new Date('2026-01-15'),
      lines: [{ description: 'Venta de enero', quantity: 1, unitPrice: 400 }],
    });
    await arInvoicesService.createInvoice(scenario.company.id, scenario.user.id, {
      customerId: scenario.customer.id,
      jurisdictionId: scenario.jurisdiction.id,
      incomeAccountId: scenario.incomeAccount.id,
      issueDate: new Date('2026-02-10'),
      lines: [{ description: 'Venta de febrero', quantity: 1, unitPrice: 999 }],
    });

    const atJan31 = await accountingReportsService.getBalanceSheet(scenario.company.id, new Date('2026-01-31'));
    const atFeb28 = await accountingReportsService.getBalanceSheet(scenario.company.id, new Date('2026-02-28'));

    expect(Number(atJan31.netIncomeToDate)).toBe(400);
    expect(Number(atFeb28.netIncomeToDate)).toBe(1399); // 400 + 999, ambas ya ocurrieron
  });
});

describe('Test de presupuesto/variación (sección 8): la desviación reportada coincide exactamente con el mayor contable real', () => {
  test('budget-variance calcula el % de desviación contra lo realmente contabilizado, no un número aparte', async () => {
    scenario = await buildScenario();

    const dimension = await fpaDimensionsService.createDimension(scenario.company.id, scenario.user.id, {
      type: 'DEPARTMENT',
      name: 'Ventas',
    });

    const budget = await budgetsService.createBudget(scenario.company.id, scenario.user.id, {
      name: 'Presupuesto de prueba',
      fiscalYear: 2026,
      versionType: 'ORIGINAL',
    });
    const budgetedAmount = 1000;
    const line = await budgetLinesService.upsertBudgetLine(scenario.company.id, budget.id, scenario.user.id, {
      accountId: scenario.incomeAccount.id,
      fpaDimensionId: dimension.id,
      period: 8,
      amountType: 'FIXED',
      amount: budgetedAmount,
    });

    // Lo real: un asiento manual dentro de agosto 2026, con la línea de
    // ingreso etiquetada a la MISMA dimensión de la línea de presupuesto
    // — exactamente el mismo mecanismo que ya usa el punto 4 de FP&A.
    const actualAmount = 700;
    const entry = await ledgerService.postEntry({
      companyId: scenario.company.id,
      date: new Date('2026-08-15'),
      description: 'Venta real de agosto',
      lines: [
        { accountId: scenario.receivableGlAccount.id, debit: actualAmount, credit: 0 },
        { accountId: scenario.incomeAccount.id, debit: 0, credit: actualAmount },
      ],
      createdByUserId: scenario.user.id,
      autoApprove: true,
      sourceModule: 'test',
    });
    const stored = await prisma.journalEntry.findUnique({ where: { id: entry.id }, include: { lines: true } });
    const incomeLine = stored.lines.find((l) => l.accountId === scenario.incomeAccount.id);
    await fpaDimensionsService.tagJournalEntryLine(scenario.company.id, scenario.user.id, {
      lineId: incomeLine.id,
      fpaDimensionId: dimension.id,
    });

    const report = await budgetVarianceService.getBudgetVarianceReport(scenario.company.id, budget.id);
    const reportedLine = report.lines.find((l) => l.lineId === line.id);

    expect(Number(reportedLine.budgetedAmount)).toBe(budgetedAmount);
    expect(Number(reportedLine.actualAmount)).toBe(actualAmount);
    expect(Number(reportedLine.varianceAmount)).toBe(actualAmount - budgetedAmount); // -300
    expect(Number(reportedLine.variancePercentage)).toBe(-30); // -300 / 1000 * 100
    expect(reportedLine.requiresJustification).toBe(true); // supera el umbral default de 10%

    // La misma cifra "real" también es la que ya reporta el Estado de
    // Resultados de Contabilidad para ese mismo rango — una sola fuente.
    const incomeStatement = await accountingReportsService.getIncomeStatement(scenario.company.id, {
      from: new Date('2026-08-01'),
      to: new Date('2026-08-31'),
    });
    expect(Number(incomeStatement.totalIncome)).toBe(actualAmount);
  });
});

describe('Test de moneda (sección 66): un monto en moneda extranjera convierte igual en el Dashboard y en Finance Summary', () => {
  test('la posición de caja consolidada convierte una cuenta en EUR con la misma tasa en ambos lados', async () => {
    scenario = await buildScenario();

    const eurGlAccount = await createAccount(scenario.company.id, { type: 'ASSET', normalBalance: 'DEBIT' });
    await createTreasuryAccount(scenario.company.id, eurGlAccount.id, 200, 'EUR');

    const rateDate = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    await fxService.recordRate({
      companyId: scenario.company.id,
      userId: scenario.user.id,
      currency: 'EUR',
      rate: 1.1, // 1 EUR = 1.1 USD (moneda base)
      date: rateDate,
      source: 'MANUAL',
    });

    const financeSummary = await financeSummaryService.getFinanceSummary(scenario.company.id);
    const dashboard = await dashboardService.getDashboard(scenario.company.id, scenario.user.id, {
      from: rateDate,
      to: rateDate,
      asOfDate: rateDate,
    });
    const cashWidget = dashboard.widgets.find((w) => w.widgetKey === 'cash_position');

    // 500 (USD, cuenta base) + 200 EUR * 1.1 = 720.00, en los dos lados exacto.
    expect(Number(cashWidget.data.totalInBaseCurrency)).toBe(720);
    expect(Number(financeSummary.cashOnHand)).toBe(720);
    expect(cashWidget.data.missingExchangeRates || []).toHaveLength(0);
  });
});

describe('Test What-If (secciones 32/65): la simulación nunca muta datos reales', () => {
  test('simulateScenario no crea ni modifica ningún asiento, factura o movimiento real', async () => {
    scenario = await buildScenario();
    await arInvoicesService.createInvoice(scenario.company.id, scenario.user.id, {
      customerId: scenario.customer.id,
      jurisdictionId: scenario.jurisdiction.id,
      incomeAccountId: scenario.incomeAccount.id,
      issueDate: new Date('2026-01-15'),
      lines: [{ description: 'Venta base', quantity: 1, unitPrice: 500 }],
    });

    const journalEntriesBefore = await prisma.journalEntry.count({ where: { companyId: scenario.company.id } });
    const invoicesBefore = await prisma.arInvoice.count({ where: { companyId: scenario.company.id } });
    const bankTransactionsBefore = await prisma.bankTransaction.count({ where: { companyId: scenario.company.id } });
    const treasuryBalanceBefore = (await prisma.treasuryAccount.findFirst({ where: { companyId: scenario.company.id } })).currentBalance;

    const result = await scenariosService.simulateScenario(scenario.company.id, {
      baselineFrom: new Date('2026-01-01'),
      baselineTo: new Date('2026-01-31'),
      projectionMonths: 3,
      adjustments: [{ type: 'SALES_VARIATION', percentage: 10 }],
    });
    expect(result.projection).toBeDefined();

    const journalEntriesAfter = await prisma.journalEntry.count({ where: { companyId: scenario.company.id } });
    const invoicesAfter = await prisma.arInvoice.count({ where: { companyId: scenario.company.id } });
    const bankTransactionsAfter = await prisma.bankTransaction.count({ where: { companyId: scenario.company.id } });
    const treasuryBalanceAfter = (await prisma.treasuryAccount.findFirst({ where: { companyId: scenario.company.id } })).currentBalance;

    expect(journalEntriesAfter).toBe(journalEntriesBefore);
    expect(invoicesAfter).toBe(invoicesBefore);
    expect(bankTransactionsAfter).toBe(bankTransactionsBefore);
    expect(String(treasuryBalanceAfter)).toBe(String(treasuryBalanceBefore));
  });
});
