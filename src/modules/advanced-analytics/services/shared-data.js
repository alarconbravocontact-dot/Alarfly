// Capa de acceso a datos compartida por varios handlers del motor de
// análisis. Solo lectura, siempre sobre servicios que ya existen en
// otros módulos — nunca recalcula un estado financiero, solo extrae de
// él lo que cada análisis necesita.
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const accountingReportsService = require('../../accounting/services/reports.service');
const kpisService = require('../../fpa/services/kpis.service');

const { Decimal } = Prisma;

function sumSection(sections, key, field = 'balance') {
  return (sections[key] || []).reduce((acc, row) => acc.plus(row[field]), new Decimal(0));
}

// Balance General resumido: totales ya calculados por Contabilidad, más
// las 2 agrupaciones que Análisis Avanzados necesita (activo/pasivo
// corriente) y el saldo de inventario (si el módulo Inventario tiene
// configurada una cuenta de inventario por defecto).
async function getBalanceSheetTotals(companyId, asOfDate) {
  // Los parámetros de un análisis llegan como texto plano (body JSON o
  // `defaultParameters` guardado); Prisma exige un `Date` real para
  // filtrar por fecha, si no falla con "premature end of input" — se
  // normaliza acá una sola vez para que ningún handler tenga que
  // acordarse de hacerlo.
  const balanceSheet = await accountingReportsService.getBalanceSheet(companyId, new Date(asOfDate));
  const currentAssets = sumSection(balanceSheet.sections, 'ACTIVO_CORRIENTE');
  const currentLiabilities = sumSection(balanceSheet.sections, 'PASIVO_CORRIENTE');

  let inventory = new Decimal(0);
  const inventorySettings = await prisma.inventorySettings.findUnique({ where: { companyId } });
  if (inventorySettings?.defaultInventoryAssetAccountId) {
    const account = await prisma.account.findUnique({ where: { id: inventorySettings.defaultInventoryAssetAccountId } });
    if (account) {
      const sectionRows = balanceSheet.sections[account.financialStatementSection || 'SIN_CLASIFICAR'] || [];
      const row = sectionRows.find((r) => r.code === account.code);
      if (row) inventory = new Decimal(row.balance);
    }
  }

  const foreignCurrencyAccounts = await prisma.account.findMany({ where: { companyId, isForeignCurrency: true } });
  let foreignCurrencyBalance = new Decimal(0);
  for (const account of foreignCurrencyAccounts) {
    const sectionRows = balanceSheet.sections[account.financialStatementSection || 'SIN_CLASIFICAR'] || [];
    const row = sectionRows.find((r) => r.code === account.code);
    if (row) foreignCurrencyBalance = foreignCurrencyBalance.plus(row.balance);
  }

  return {
    asOfDate,
    totalAssets: new Decimal(balanceSheet.totalAssets),
    totalLiabilities: new Decimal(balanceSheet.totalLiabilities),
    totalEquity: new Decimal(balanceSheet.totalEquity),
    currentAssets,
    currentLiabilities,
    inventory,
    foreignCurrencyBalance,
    rawBalanceSheet: balanceSheet,
  };
}

// Estado de Resultados resumido, más los intereses del periodo
// (reutilizando `fpa/kpis.service.getEbitda`, que ya sabe encontrar el
// gasto financiero real de la deuda — no se vuelve a resolver acá).
async function getIncomeStatementTotals(companyId, from, to) {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const incomeStatement = await accountingReportsService.getIncomeStatement(companyId, { from: fromDate, to: toDate });
  const cogs = sumSection(incomeStatement.sections, 'COSTO_VENTAS', 'amount');
  const ebitdaData = await kpisService.getEbitda(companyId, { from: fromDate, to: toDate });

  return {
    from: fromDate,
    to: toDate,
    revenue: new Decimal(incomeStatement.totalIncome),
    totalExpense: new Decimal(incomeStatement.totalExpense),
    netIncome: new Decimal(incomeStatement.netIncome),
    cogs,
    interestExpense: new Decimal(ebitdaData.interestExpense),
    rawIncomeStatement: incomeStatement,
  };
}

// Reparte el gasto EXPENSE del periodo entre costo fijo y variable,
// según `AnalysisCostClassification` (propia de este módulo, ver
// schema). Una cuenta de gasto sin clasificar se trata como fija por
// defecto — así el punto de equilibrio siempre puede calcularse con lo
// que haya clasificado hasta ahora, y se avisa cuánto quedó sin
// clasificar para que el usuario lo complete.
async function getCostBreakdown(companyId, incomeStatement) {
  const [classifications, expenseAccounts] = await Promise.all([
    prisma.analysisCostClassification.findMany({
      where: { companyId },
      select: { accountId: true, costBehavior: true, account: { select: { code: true } } },
    }),
    prisma.account.findMany({ where: { companyId, type: 'EXPENSE' }, select: { code: true } }),
  ]);
  const behaviorByCode = new Map(classifications.map((c) => [c.account.code, c.costBehavior]));
  const expenseCodes = new Set(expenseAccounts.map((a) => a.code));

  let fixedCosts = new Decimal(0);
  let variableCosts = new Decimal(0);
  let unclassifiedAmount = new Decimal(0);
  let unclassifiedCount = 0;

  // El Estado de Resultados mezcla filas de ingreso y de gasto en la
  // misma sección cuando no están clasificadas (ej. "SIN_CLASIFICAR"
  // puede traer una cuenta de ingreso y una de gasto juntas) — por eso
  // se filtra por el tipo real de la cuenta, no por en qué sección cayó.
  const expenseRows = Object.values(incomeStatement.sections)
    .flat()
    .filter((row) => expenseCodes.has(row.code));
  for (const row of expenseRows) {
    const behavior = behaviorByCode.get(row.code);
    const amount = new Decimal(row.amount);
    if (behavior === 'VARIABLE') {
      variableCosts = variableCosts.plus(amount);
    } else {
      // FIXED explícito, o sin clasificar (default conservador).
      fixedCosts = fixedCosts.plus(amount);
      if (!behavior) {
        unclassifiedAmount = unclassifiedAmount.plus(amount);
        unclassifiedCount += 1;
      }
    }
  }

  return { fixedCosts, variableCosts, unclassifiedAmount, unclassifiedCount };
}

module.exports = { sumSection, getBalanceSheetTotals, getIncomeStatementTotals, getCostBreakdown };
