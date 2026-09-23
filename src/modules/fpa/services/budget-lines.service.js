const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const { assertValidFormulaSyntax } = require('./formula-engine');

async function assertBudgetEditable(companyId, budgetId) {
  const budget = await prisma.budget.findFirst({ where: { id: budgetId, companyId } });
  if (!budget) {
    throw new AppError('El presupuesto indicado no existe.', 404, 'BUDGET_NOT_FOUND');
  }
  if (budget.status !== 'DRAFT') {
    throw new AppError('Solo se pueden editar líneas de un presupuesto en borrador (DRAFT).', 409, 'BUDGET_NOT_EDITABLE');
  }
  return budget;
}

// Crea o reemplaza (upsert) la línea de una cuenta+dimensión+mes: así
// capturar el presupuesto es simplemente "mandar el valor de cada
// casilla", sin que el usuario tenga que saber si ya existía.
async function upsertBudgetLine(companyId, budgetId, userId, data) {
  await assertBudgetEditable(companyId, budgetId);

  const account = await prisma.account.findFirst({ where: { id: data.accountId, companyId } });
  if (!account) {
    throw new AppError('La cuenta contable indicada no existe en esta empresa.', 400, 'ACCOUNT_NOT_FOUND');
  }

  const dimension = await prisma.fpaDimension.findFirst({ where: { id: data.fpaDimensionId, companyId } });
  if (!dimension) {
    throw new AppError('La dimensión indicada no existe en esta empresa.', 400, 'FPA_DIMENSION_NOT_FOUND');
  }

  if (data.amountType === 'FIXED' && (data.amount === undefined || data.amount === null)) {
    throw new AppError('Una línea de monto fijo necesita un valor en "amount".', 400, 'AMOUNT_REQUIRED');
  }
  if (data.amountType === 'FORMULA' && !data.formula) {
    throw new AppError('Una línea basada en fórmula necesita un valor en "formula".', 400, 'FORMULA_REQUIRED');
  }
  // Se valida la sintaxis apenas se guarda la línea, para no descubrir
  // una fórmula mal escrita hasta que alguien pida el reporte de
  // desviación (punto 4) — ahí ya sería tarde para corregirla a tiempo.
  if (data.amountType === 'FORMULA') {
    assertValidFormulaSyntax(data.formula);
  }

  const key = {
    budgetId_accountId_fpaDimensionId_period: {
      budgetId,
      accountId: data.accountId,
      fpaDimensionId: data.fpaDimensionId,
      period: data.period,
    },
  };

  return prisma.$transaction(async (tx) => {
    const line = await tx.budgetLine.upsert({
      where: key,
      create: {
        budgetId,
        accountId: data.accountId,
        fpaDimensionId: data.fpaDimensionId,
        period: data.period,
        amountType: data.amountType,
        amount: data.amountType === 'FIXED' ? data.amount : null,
        formula: data.amountType === 'FORMULA' ? data.formula : null,
        notes: data.notes || null,
      },
      update: {
        amountType: data.amountType,
        amount: data.amountType === 'FIXED' ? data.amount : null,
        formula: data.amountType === 'FORMULA' ? data.formula : null,
        notes: data.notes || null,
      },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'budget_line.upserted',
        entityType: 'BudgetLine',
        entityId: line.id,
        oldValue: null,
        newValue: line,
      },
      tx
    );
    return line;
  });
}

async function deleteBudgetLine(companyId, budgetId, lineId, userId) {
  await assertBudgetEditable(companyId, budgetId);

  const line = await prisma.budgetLine.findFirst({ where: { id: lineId, budgetId } });
  if (!line) {
    throw new AppError('La línea de presupuesto indicada no existe.', 404, 'BUDGET_LINE_NOT_FOUND');
  }

  return prisma.$transaction(async (tx) => {
    await tx.budgetLine.delete({ where: { id: lineId } });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'budget_line.deleted',
        entityType: 'BudgetLine',
        entityId: lineId,
        oldValue: line,
        newValue: null,
      },
      tx
    );
  });
}

module.exports = { upsertBudgetLine, deleteBudgetLine };
