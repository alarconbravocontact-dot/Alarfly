const AppError = require('../utils/AppError');

// Función pura (sin base de datos) para poder probarla fácil con tests
// unitarios: un periodo cerrado nunca deja pasar un asiento.
function assertPeriodOpen(period) {
  if (!period) {
    throw new AppError('El periodo contable indicado no existe.', 404, 'PERIOD_NOT_FOUND');
  }
  if (period.status !== 'OPEN') {
    throw new AppError(
      `El periodo "${period.name}" está cerrado. No se pueden crear ni editar asientos en él.`,
      409,
      'PERIOD_CLOSED'
    );
  }
}

function periodsOverlap(a, b) {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

module.exports = { assertPeriodOpen, periodsOverlap };
