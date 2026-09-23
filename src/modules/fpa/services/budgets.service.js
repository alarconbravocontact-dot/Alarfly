const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const { determineNextVersion, assertCanTransition } = require('./budget.rules');

async function createBudget(companyId, userId, data) {
  const versionType = data.versionType || 'ORIGINAL';

  const existing = await prisma.budget.findMany({
    where: { companyId, fiscalYear: data.fiscalYear },
    select: { versionNumber: true },
  });
  const versionNumber = determineNextVersion(existing.map((b) => b.versionNumber), versionType);

  let previousLines = [];
  if (versionType === 'REFORECAST') {
    if (!data.previousVersionId) {
      throw new AppError('Un REFORECAST debe indicar de qué versión parte (previousVersionId).', 400, 'PREVIOUS_VERSION_REQUIRED');
    }
    const previous = await prisma.budget.findFirst({
      where: { id: data.previousVersionId, companyId, fiscalYear: data.fiscalYear },
    });
    if (!previous) {
      throw new AppError('La versión anterior indicada no existe en este año fiscal.', 404, 'PREVIOUS_VERSION_NOT_FOUND');
    }
    previousLines = await prisma.budgetLine.findMany({ where: { budgetId: data.previousVersionId } });
  }

  return prisma.$transaction(async (tx) => {
    const budget = await tx.budget.create({
      data: {
        companyId,
        name: data.name,
        fiscalYear: data.fiscalYear,
        versionNumber,
        versionType,
        previousVersionId: data.previousVersionId || null,
        createdByUserId: userId,
      },
    });

    // Un REFORECAST arranca con una copia de las líneas de la versión
    // anterior, para que el usuario ajuste en vez de capturar el
    // presupuesto completo de nuevo (patrón normal de FP&A).
    if (previousLines.length > 0) {
      await tx.budgetLine.createMany({
        data: previousLines.map((line) => ({
          budgetId: budget.id,
          accountId: line.accountId,
          fpaDimensionId: line.fpaDimensionId,
          period: line.period,
          amountType: line.amountType,
          amount: line.amount,
          formula: line.formula,
          notes: line.notes,
        })),
      });
    }

    await auditService.log(
      {
        companyId,
        userId,
        action: 'budget.created',
        entityType: 'Budget',
        entityId: budget.id,
        oldValue: null,
        newValue: budget,
      },
      tx
    );

    return budget;
  });
}

async function listBudgets(companyId, { fiscalYear, status } = {}) {
  return prisma.budget.findMany({
    where: { companyId, fiscalYear: fiscalYear || undefined, status: status || undefined },
    orderBy: [{ fiscalYear: 'desc' }, { versionNumber: 'desc' }],
  });
}

async function getBudget(companyId, id) {
  const budget = await prisma.budget.findFirst({
    where: { id, companyId },
    include: { lines: { include: { account: true, fpaDimension: true } } },
  });
  if (!budget) {
    throw new AppError('El presupuesto indicado no existe.', 404, 'BUDGET_NOT_FOUND');
  }
  return budget;
}

async function transitionBudget(companyId, id, userId, targetStatus) {
  const budget = await prisma.budget.findFirst({ where: { id, companyId } });
  if (!budget) {
    throw new AppError('El presupuesto indicado no existe.', 404, 'BUDGET_NOT_FOUND');
  }
  assertCanTransition(budget.status, targetStatus);

  const allowedChanges = { status: targetStatus };
  if (targetStatus === 'APPROVED') {
    allowedChanges.approvedByUserId = userId;
    allowedChanges.approvedAt = new Date();
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.budget.update({ where: { id }, data: allowedChanges });
    await auditService.log(
      {
        companyId,
        userId,
        action: `budget.${targetStatus.toLowerCase()}`,
        entityType: 'Budget',
        entityId: id,
        oldValue: { status: budget.status },
        newValue: { status: targetStatus },
      },
      tx
    );
    return updated;
  });
}

module.exports = { createBudget, listBudgets, getBudget, transitionBudget };
