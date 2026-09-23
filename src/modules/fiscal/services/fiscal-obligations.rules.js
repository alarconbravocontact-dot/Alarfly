const AppError = require('../../../core/utils/AppError');

function atUtcMidnight(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Función pura: calcula la próxima fecha de vencimiento de una
// obligación fiscal recurrente, a partir de una fecha de referencia.
// Simplificación consciente: BIMONTHLY asume que los periodos van
// pareados con la paridad de `dueMonth` (ej: dueMonth=1 -> vence en
// enero, marzo, mayo...); algunos países usan calendarios bimestrales
// con parejas de meses distintas — se puede afinar más adelante si
// hace falta un caso real que no encaje.
function calculateNextDueDate(obligation, fromDate) {
  const { recurrence, dueDayOfMonth, dueMonth } = obligation;
  if (dueDayOfMonth < 1 || dueDayOfMonth > 31) {
    throw new AppError('El día de vencimiento debe estar entre 1 y 31.', 400, 'INVALID_DUE_DAY');
  }

  const from = atUtcMidnight(fromDate);
  const year = from.getUTCFullYear();

  if (recurrence === 'MONTHLY') {
    let candidate = new Date(Date.UTC(year, from.getUTCMonth(), dueDayOfMonth));
    if (candidate < from) candidate = new Date(Date.UTC(year, from.getUTCMonth() + 1, dueDayOfMonth));
    return candidate;
  }

  if (recurrence === 'ANNUAL') {
    if (!dueMonth) {
      throw new AppError('Una obligación anual necesita indicar el mes de vencimiento (dueMonth).', 400, 'DUE_MONTH_REQUIRED');
    }
    let candidate = new Date(Date.UTC(year, dueMonth - 1, dueDayOfMonth));
    if (candidate < from) candidate = new Date(Date.UTC(year + 1, dueMonth - 1, dueDayOfMonth));
    return candidate;
  }

  if (recurrence === 'BIMONTHLY') {
    if (!dueMonth) {
      throw new AppError('Una obligación bimestral necesita indicar un mes de referencia (dueMonth).', 400, 'DUE_MONTH_REQUIRED');
    }
    const anchorParity = (dueMonth - 1) % 2;
    let month = from.getUTCMonth();
    while (month % 2 !== anchorParity) month += 1;
    let candidate = new Date(Date.UTC(year, month, dueDayOfMonth));
    if (candidate < from) candidate = new Date(Date.UTC(year, month + 2, dueDayOfMonth));
    return candidate;
  }

  throw new AppError(`Recurrencia no soportada: "${recurrence}".`, 400, 'UNSUPPORTED_RECURRENCE');
}

module.exports = { calculateNextDueDate };
