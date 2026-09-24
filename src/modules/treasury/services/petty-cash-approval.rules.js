const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');
const { assertDifferentActors } = require('../../../core/workflow/segregation.rules');

const { Decimal } = Prisma;

const APPROVER_ROLES = ['ADMIN'];

// Función pura: valida el flujo maker-checker de un gasto de caja
// chica. El empleado que registra el gasto (maker) nunca puede ser
// quien lo aprueba (checker), sin importar su rol.
function assertCanApproveExpense({ expense, approverUserId, approverRole }) {
  if (expense.status !== 'PENDING_APPROVAL') {
    throw new AppError('Este gasto no está pendiente de aprobación.', 409, 'EXPENSE_NOT_PENDING');
  }
  assertDifferentActors(expense.registeredByUserId, approverUserId, {
    message: 'Quien registró el gasto no puede aprobarlo (maker-checker): debe hacerlo un supervisor distinto.',
  });
  if (!APPROVER_ROLES.includes(approverRole)) {
    throw new AppError('Tu rol no tiene permiso para aprobar gastos de caja chica.', 403, 'ROLE_NOT_ALLOWED');
  }
}

function needsReplenishment(fund) {
  return new Decimal(fund.currentBalance).lessThan(fund.replenishmentThreshold);
}

module.exports = { assertCanApproveExpense, needsReplenishment, APPROVER_ROLES };
