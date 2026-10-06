// Funciones puras del flujo de Gastos de Personal. Maker-checker
// reutilizando `core/workflow/segregation.rules` (la misma regla que ya
// usan Caja Chica/Órdenes de Pago/Conteos Físicos) — nunca un chequeo
// nuevo escrito a mano una cuarta vez.
const AppError = require('../../../core/utils/AppError');
const { assertDifferentActors } = require('../../../core/workflow/segregation.rules');

function assertCanDecide(expense, approverUserId) {
  if (expense.status !== 'PENDING_APPROVAL') {
    throw new AppError('Este gasto no está pendiente de aprobación.', 409, 'EXPENSE_NOT_PENDING');
  }
  assertDifferentActors(expense.registeredByUserId, approverUserId, {
    message: 'Quien registró el gasto no puede aprobarlo o rechazarlo (maker-checker): debe hacerlo otra persona.',
  });
}

function assertCanReimburse(expense) {
  if (expense.status !== 'APPROVED') {
    throw new AppError('Solo se pueden reembolsar gastos ya aprobados.', 409, 'EXPENSE_NOT_APPROVED');
  }
}

module.exports = { assertCanDecide, assertCanReimburse };
