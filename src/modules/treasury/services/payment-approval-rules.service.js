const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');

async function createRule(companyId, userId, data) {
  if (data.maxAmount !== undefined && data.maxAmount !== null && data.maxAmount < data.minAmount) {
    throw new AppError('El monto máximo no puede ser menor que el mínimo.', 400, 'INVALID_AMOUNT_RANGE');
  }
  if (!data.levels || data.levels.length === 0) {
    throw new AppError('La regla necesita al menos un nivel de aprobación.', 400, 'MISSING_LEVELS');
  }

  const levelNumbers = data.levels.map((l) => l.level);
  if (new Set(levelNumbers).size !== levelNumbers.length) {
    throw new AppError('No puede haber niveles repetidos en la misma regla.', 400, 'DUPLICATE_LEVELS');
  }

  return prisma.$transaction(async (tx) => {
    const rule = await tx.paymentApprovalRule.create({
      data: {
        companyId,
        name: data.name,
        minAmount: data.minAmount,
        maxAmount: data.maxAmount ?? null,
        levels: { create: data.levels.map((l) => ({ level: l.level, allowedRoles: l.allowedRoles })) },
      },
      include: { levels: true },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'payment_approval_rule.created',
        entityType: 'PaymentApprovalRule',
        entityId: rule.id,
        oldValue: null,
        newValue: rule,
      },
      tx
    );
    return rule;
  });
}

async function listRules(companyId, { isActive } = {}) {
  return prisma.paymentApprovalRule.findMany({
    where: { companyId, isActive: isActive === undefined ? undefined : isActive },
    include: { levels: { orderBy: { level: 'asc' } } },
    orderBy: { minAmount: 'asc' },
  });
}

async function getRule(companyId, id) {
  const rule = await prisma.paymentApprovalRule.findFirst({
    where: { id, companyId },
    include: { levels: { orderBy: { level: 'asc' } } },
  });
  if (!rule) {
    throw new AppError('La regla de aprobación indicada no existe.', 404, 'RULE_NOT_FOUND');
  }
  return rule;
}

async function deactivateRule(companyId, id, userId) {
  const rule = await getRule(companyId, id);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.paymentApprovalRule.update({ where: { id }, data: { isActive: false } });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'payment_approval_rule.deactivated',
        entityType: 'PaymentApprovalRule',
        entityId: id,
        oldValue: { isActive: rule.isActive },
        newValue: { isActive: false },
      },
      tx
    );
    return updated;
  });
}

module.exports = { createRule, listRules, getRule, deactivateRule };
