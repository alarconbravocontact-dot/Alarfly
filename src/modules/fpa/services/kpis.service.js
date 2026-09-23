const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const reportsService = require('../../accounting/services/reports.service');
const treasuryAccountsService = require('../../treasury/services/treasury-accounts.service');
const { evaluateFormula } = require('./formula-engine');
const { calculateEbitda, calculateBurnRate, calculateRunway } = require('./kpi.rules');

const { Decimal } = Prisma;

function monthsBetweenInclusive(from, to) {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth()) + 1;
}

// getIncomeStatement omite las cuentas sin movimiento en el rango (para
// no ensuciar el reporte visual), pero para una fórmula eso sería un
// error: "cuenta X" == 0 en el periodo es un valor válido, no una
// variable desconocida. Por eso se arranca con TODAS las cuentas de
// ingreso/gasto de la empresa en 0, y se sobreescriben con lo real.
async function amountByAccountCode(companyId, incomeStatement) {
  const accounts = await prisma.account.findMany({
    where: { companyId, type: { in: ['INCOME', 'EXPENSE'] } },
    select: { code: true },
  });
  const map = {};
  for (const account of accounts) map[account.code] = '0';

  const flat = Object.values(incomeStatement.sections).flat();
  for (const account of flat) map[account.code] = account.amount;
  return map;
}

async function getEbitda(companyId, { from, to }) {
  const incomeStatement = await reportsService.getIncomeStatement(companyId, { from, to });
  const amounts = await amountByAccountCode(companyId, incomeStatement);

  const debts = await prisma.debt.findMany({ where: { companyId }, select: { interestExpenseAccount: { select: { code: true } } } });
  let interestExpense = new Decimal(0);
  for (const code of new Set(debts.map((d) => d.interestExpenseAccount?.code).filter(Boolean))) {
    interestExpense = interestExpense.plus(amounts[code] || 0);
  }

  const fixedAssets = await prisma.fixedAsset.findMany({
    where: { companyId },
    select: { depreciationExpenseAccount: { select: { code: true } } },
  });
  let depreciationAndAmortization = new Decimal(0);
  for (const code of new Set(fixedAssets.map((a) => a.depreciationExpenseAccount?.code).filter(Boolean))) {
    depreciationAndAmortization = depreciationAndAmortization.plus(amounts[code] || 0);
  }

  const ebitda = calculateEbitda({
    netIncome: incomeStatement.netIncome,
    interestExpense,
    depreciationAndAmortization,
  });

  return {
    from,
    to,
    netIncome: incomeStatement.netIncome,
    interestExpense: interestExpense.toFixed(2),
    depreciationAndAmortization: depreciationAndAmortization.toFixed(2),
    ebitda: ebitda.toFixed(2),
  };
}

async function getBurnRateAndRunway(companyId, { from, to }) {
  const incomeStatement = await reportsService.getIncomeStatement(companyId, { from, to });
  const months = monthsBetweenInclusive(from, to);
  const monthlyBurnRate = calculateBurnRate({ netIncome: incomeStatement.netIncome, months });

  const cashPosition = await treasuryAccountsService.getConsolidatedCashPosition(companyId, to);
  const runwayMonths = calculateRunway({ liquidityCushion: cashPosition.liquidityCushion, monthlyBurnRate });

  return {
    from,
    to,
    months,
    netIncome: incomeStatement.netIncome,
    monthlyBurnRate: monthlyBurnRate.toFixed(2),
    liquidityCushion: cashPosition.liquidityCushion,
    runwayMonths: runwayMonths ? runwayMonths.toFixed(1) : null,
  };
}

async function createKpiDefinition(companyId, userId, data) {
  const existing = await prisma.kpiDefinition.findUnique({ where: { companyId_name: { companyId, name: data.name } } });
  if (existing) {
    throw new AppError(`Ya existe un KPI con el nombre "${data.name}".`, 409, 'KPI_NAME_EXISTS');
  }
  return prisma.$transaction(async (tx) => {
    const kpi = await tx.kpiDefinition.create({
      data: { companyId, name: data.name, description: data.description || null, formula: data.formula },
    });
    await auditService.log(
      { companyId, userId, action: 'kpi_definition.created', entityType: 'KpiDefinition', entityId: kpi.id, oldValue: null, newValue: kpi },
      tx
    );
    return kpi;
  });
}

async function listKpiDefinitions(companyId, { isActive } = {}) {
  return prisma.kpiDefinition.findMany({
    where: { companyId, isActive: isActive === undefined ? undefined : isActive },
    orderBy: { name: 'asc' },
  });
}

async function evaluateKpi(companyId, kpiId, { from, to }) {
  const kpi = await prisma.kpiDefinition.findFirst({ where: { id: kpiId, companyId } });
  if (!kpi) {
    throw new AppError('El KPI indicado no existe.', 404, 'KPI_NOT_FOUND');
  }
  const incomeStatement = await reportsService.getIncomeStatement(companyId, { from, to });
  const amounts = await amountByAccountCode(companyId, incomeStatement);
  const value = evaluateFormula(kpi.formula, amounts);
  return { kpi: { id: kpi.id, name: kpi.name, formula: kpi.formula }, from, to, value: value.toFixed(4) };
}

async function compareKpi(companyId, kpiId, rangeA, rangeB) {
  const [a, b] = await Promise.all([evaluateKpi(companyId, kpiId, rangeA), evaluateKpi(companyId, kpiId, rangeB)]);
  const delta = new Decimal(b.value).minus(a.value);
  return { kpi: a.kpi, periodA: a, periodB: b, delta: delta.toFixed(4) };
}

module.exports = { getEbitda, getBurnRateAndRunway, createKpiDefinition, listKpiDefinitions, evaluateKpi, compareKpi };
