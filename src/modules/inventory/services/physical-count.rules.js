const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');
const { assertDifferentActors } = require('../../../core/workflow/segregation.rules');

const { Decimal } = Prisma;

// Función pura: diferencia entre lo contado y lo que dice el sistema
// (positivo = sobrante, negativo = faltante).
function calculateCountDifference(systemQuantity, countedQuantity) {
  return new Decimal(countedQuantity).minus(systemQuantity);
}

// Función pura: maker-checker — quien hizo el conteo no puede aprobar
// su propio ajuste, y el conteo debe estar pendiente de aprobación.
function assertCanApproveCount(count, approverUserId) {
  if (count.status !== 'PENDING_APPROVAL') {
    throw new AppError('Este conteo no está pendiente de aprobación.', 409, 'INVALID_COUNT_STATUS');
  }
  assertDifferentActors(count.countedByUserId, approverUserId, {
    message: 'Quien realizó el conteo no puede aprobar su propio ajuste.',
    code: 'SAME_USER_APPROVAL',
  });
}

module.exports = { calculateCountDifference, assertCanApproveCount };
