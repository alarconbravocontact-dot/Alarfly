const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');

const { Decimal } = Prisma;

// Función pura: de todas las reglas activas de la empresa, cuál cubre
// este monto (minAmount <= monto <= maxAmount, o sin tope si maxAmount
// es null). Si dos reglas se cruzan, gana la más específica (rango más
// angosto) en vez de la primera que aparezca.
function findMatchingRule(rules, amount) {
  const amt = new Decimal(amount);

  const candidates = rules.filter((rule) => {
    if (!rule.isActive) return false;
    if (amt.lessThan(rule.minAmount)) return false;
    if (rule.maxAmount !== null && rule.maxAmount !== undefined && amt.greaterThan(rule.maxAmount)) return false;
    return true;
  });

  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => {
    const widthA = a.maxAmount === null ? new Decimal(Infinity) : new Decimal(a.maxAmount).minus(a.minAmount);
    const widthB = b.maxAmount === null ? new Decimal(Infinity) : new Decimal(b.maxAmount).minus(b.minAmount);
    return widthA.comparedTo(widthB);
  })[0];
}

// Función pura: valida si un usuario puede aprobar el siguiente nivel
// pendiente de una orden de pago. No toca la base de datos; recibe todo
// lo que necesita ya cargado.
function assertCanApprove({ order, existingApprovals, level, allowedRolesForLevel, approverUserId, approverRole }) {
  if (order.status !== 'PENDING_APPROVAL') {
    throw new AppError('Esta orden de pago no está pendiente de aprobación.', 409, 'ORDER_NOT_PENDING');
  }
  if (level > order.requiredLevels) {
    throw new AppError('Esta orden de pago ya completó todos sus niveles de aprobación.', 409, 'ALL_LEVELS_COMPLETE');
  }
  if (approverUserId === order.createdByUserId) {
    throw new AppError('Quien crea la orden de pago no puede aprobarla (maker-checker).', 403, 'SELF_APPROVAL_FORBIDDEN');
  }
  if (existingApprovals.some((a) => a.approvedByUserId === approverUserId)) {
    throw new AppError('Ya aprobaste un nivel anterior de esta misma orden.', 403, 'DUPLICATE_APPROVER');
  }
  if (!allowedRolesForLevel || !allowedRolesForLevel.includes(approverRole)) {
    throw new AppError(`Tu rol no tiene permiso para aprobar el nivel ${level} de esta orden.`, 403, 'ROLE_NOT_ALLOWED');
  }
}

function nextApprovalLevel(existingApprovals) {
  return existingApprovals.length + 1;
}

function isFullyApproved(level, requiredLevels) {
  return level === requiredLevels;
}

module.exports = { findMatchingRule, assertCanApprove, nextApprovalLevel, isFullyApproved };
