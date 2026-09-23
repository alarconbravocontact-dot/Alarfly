const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const { resolveBudgetLineAmounts, calculateVariance, exceedsThreshold } = require('./budget.rules');

const { Decimal } = Prisma;

function periodToDateRange(fiscalYear, period) {
  const from = new Date(Date.UTC(fiscalYear, period - 1, 1));
  const to = new Date(Date.UTC(fiscalYear, period, 0, 23, 59, 59, 999));
  return { from, to };
}

async function getFpaSettings(companyId) {
  const settings = await prisma.fpaSettings.upsert({
    where: { companyId },
    update: {},
    create: { companyId },
  });
  return settings;
}

async function updateFpaSettings(companyId, userId, changes) {
  const before = await getFpaSettings(companyId);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.fpaSettings.update({
      where: { companyId },
      data: { varianceThresholdPercentage: changes.varianceThresholdPercentage },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'fpa_settings.updated',
        entityType: 'FpaSettings',
        entityId: updated.id,
        oldValue: before,
        newValue: updated,
      },
      tx
    );
    return updated;
  });
}

// Suma lo real de una cuenta+dimensión en un rango de fechas, usando la
// misma tabla puente del punto 1 (JournalEntryLineFpaDimension): así
// "lo real" de la desviación siempre coincide con lo que ya se etiquetó
// como perteneciente a esa dimensión, sin inventar otra fuente de
// datos. Solo cuenta asientos APPROVED, igual que el resto de reportes.
async function getActualAmount(companyId, accountId, fpaDimensionId, from, to) {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  const sums = await prisma.journalEntryLine.aggregate({
    where: {
      accountId,
      journalEntry: { companyId, status: 'APPROVED', date: { gte: from, lte: to } },
      fpaDimensionTags: { some: { fpaDimensionId } },
    },
    _sum: { debit: true, credit: true },
  });
  const debit = new Decimal(sums._sum.debit || 0);
  const credit = new Decimal(sums._sum.credit || 0);
  return account.normalBalance === 'DEBIT' ? debit.minus(credit) : credit.minus(debit);
}

async function getBudgetVarianceReport(companyId, budgetId) {
  const budget = await prisma.budget.findFirst({
    where: { id: budgetId, companyId },
    include: { lines: { include: { account: true, fpaDimension: true } } },
  });
  if (!budget) {
    throw new AppError('El presupuesto indicado no existe.', 404, 'BUDGET_NOT_FOUND');
  }

  const settings = await getFpaSettings(companyId);

  const resolved = resolveBudgetLineAmounts(
    budget.lines.map((line) => ({
      id: line.id,
      accountCode: line.account.code,
      period: line.period,
      amountType: line.amountType,
      amount: line.amount,
      formula: line.formula,
    }))
  );

  const lines = [];
  for (const line of budget.lines) {
    const budgetedAmount = resolved.get(line.id);
    const { from, to } = periodToDateRange(budget.fiscalYear, line.period);
    const actualAmount = await getActualAmount(companyId, line.accountId, line.fpaDimensionId, from, to);
    const { varianceAmount, variancePercentage } = calculateVariance(budgetedAmount, actualAmount);
    const requiresJustification = exceedsThreshold(variancePercentage, settings.varianceThresholdPercentage);

    let isJustified = false;
    if (requiresJustification) {
      const latest = await prisma.budgetVarianceJustification.findFirst({
        where: { budgetLineId: line.id },
        orderBy: { createdAt: 'desc' },
      });
      isJustified =
        !!latest && new Decimal(latest.actualAmount).equals(actualAmount) && new Decimal(latest.budgetedAmount).equals(budgetedAmount);
    }

    lines.push({
      lineId: line.id,
      account: { id: line.account.id, code: line.account.code, name: line.account.name },
      fpaDimension: { id: line.fpaDimension.id, name: line.fpaDimension.name },
      period: line.period,
      budgetedAmount: budgetedAmount.toFixed(2),
      actualAmount: actualAmount.toFixed(2),
      varianceAmount: varianceAmount.toFixed(2),
      variancePercentage: variancePercentage.toFixed(2),
      requiresJustification,
      isJustified,
    });
  }

  return {
    budgetId,
    thresholdPercentage: settings.varianceThresholdPercentage.toFixed(2),
    lines,
  };
}

async function submitJustification(companyId, budgetLineId, userId, comment) {
  const line = await prisma.budgetLine.findFirst({
    where: { id: budgetLineId, budget: { companyId } },
    include: { budget: true, account: true },
  });
  if (!line) {
    throw new AppError('La línea de presupuesto indicada no existe.', 404, 'BUDGET_LINE_NOT_FOUND');
  }

  const siblingLines = await prisma.budgetLine.findMany({
    where: { budgetId: line.budgetId },
    include: { account: true },
  });
  const resolved = resolveBudgetLineAmounts(
    siblingLines.map((l) => ({
      id: l.id,
      accountCode: l.account.code,
      period: l.period,
      amountType: l.amountType,
      amount: l.amount,
      formula: l.formula,
    }))
  );
  const budgetedAmount = resolved.get(line.id);

  const { from, to } = periodToDateRange(line.budget.fiscalYear, line.period);
  const actualAmount = await getActualAmount(companyId, line.accountId, line.fpaDimensionId, from, to);
  const { variancePercentage } = calculateVariance(budgetedAmount, actualAmount);

  return prisma.$transaction(async (tx) => {
    const justification = await tx.budgetVarianceJustification.create({
      data: {
        companyId,
        budgetLineId,
        budgetedAmount,
        actualAmount,
        variancePercentage,
        comment,
        createdByUserId: userId,
      },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'budget_variance.justified',
        entityType: 'BudgetVarianceJustification',
        entityId: justification.id,
        oldValue: null,
        newValue: justification,
      },
      tx
    );
    return justification;
  });
}

async function listJustifications(companyId, budgetLineId) {
  const line = await prisma.budgetLine.findFirst({ where: { id: budgetLineId, budget: { companyId } } });
  if (!line) {
    throw new AppError('La línea de presupuesto indicada no existe.', 404, 'BUDGET_LINE_NOT_FOUND');
  }
  return prisma.budgetVarianceJustification.findMany({
    where: { budgetLineId },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = {
  getFpaSettings,
  updateFpaSettings,
  getBudgetVarianceReport,
  submitJustification,
  listJustifications,
};
