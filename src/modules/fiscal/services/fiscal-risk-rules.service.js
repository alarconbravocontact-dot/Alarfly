const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const { evaluateCondition } = require('./fiscal-risk.rules');

async function createRule(companyId, userId, data) {
  const existing = await prisma.fiscalRiskRule.findUnique({ where: { companyId_name: { companyId, name: data.name } } });
  if (existing) {
    throw new AppError(`Ya existe una regla con el nombre "${data.name}".`, 409, 'RULE_NAME_EXISTS');
  }
  // Valida la sintaxis apenas se guarda la regla, no hasta que se
  // intente evaluar contra una transacción real.
  evaluateCondition(data.condition, {});

  return prisma.$transaction(async (tx) => {
    const rule = await tx.fiscalRiskRule.create({
      data: {
        companyId,
        name: data.name,
        description: data.description || null,
        condition: data.condition,
        severity: data.severity || 'WARNING',
      },
    });
    await auditService.log(
      { companyId, userId, action: 'fiscal_risk_rule.created', entityType: 'FiscalRiskRule', entityId: rule.id, oldValue: null, newValue: rule },
      tx
    );
    return rule;
  });
}

async function updateRule(companyId, id, userId, changes) {
  const rule = await prisma.fiscalRiskRule.findFirst({ where: { id, companyId } });
  if (!rule) {
    throw new AppError('La regla indicada no existe.', 404, 'RULE_NOT_FOUND');
  }
  if (changes.condition) {
    evaluateCondition(changes.condition, {});
  }

  const allowedChanges = {
    name: changes.name,
    description: changes.description,
    condition: changes.condition,
    severity: changes.severity,
    isActive: changes.isActive,
  };

  return prisma.$transaction(async (tx) => {
    const updated = await tx.fiscalRiskRule.update({ where: { id }, data: allowedChanges });
    await auditService.log(
      { companyId, userId, action: 'fiscal_risk_rule.updated', entityType: 'FiscalRiskRule', entityId: id, oldValue: rule, newValue: updated },
      tx
    );
    return updated;
  });
}

async function listRules(companyId, { isActive } = {}) {
  return prisma.fiscalRiskRule.findMany({
    where: { companyId, isActive: isActive === undefined ? undefined : isActive },
    orderBy: { name: 'asc' },
  });
}

// Evalúa todas las reglas activas de la empresa contra los datos de
// una transacción fiscal en curso. Separa lo que bloquea de lo que
// solo advierte, para que quien llama decida qué hacer con cada uno.
async function evaluateTransaction(companyId, context) {
  const rules = await prisma.fiscalRiskRule.findMany({ where: { companyId, isActive: true } });

  const blocking = [];
  const warnings = [];

  for (const rule of rules) {
    let triggered;
    try {
      triggered = evaluateCondition(rule.condition, context);
    } catch {
      // Una regla mal configurada no debe tumbar el registro de una
      // transacción real; simplemente se ignora esa regla puntual.
      continue;
    }
    if (!triggered) continue;
    if (rule.severity === 'BLOCKING') blocking.push(rule);
    else warnings.push(rule);
  }

  return { blocking, warnings };
}

module.exports = { createRule, updateRule, listRules, evaluateTransaction };
