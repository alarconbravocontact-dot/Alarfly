const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Funciones puras y genéricas sobre fechas de vencimiento: las usa
// cualquier módulo que necesite avisar que algo está por vencer
// (Tesorería: pagos y cuotas; Fiscal: obligaciones fiscales).

function daysUntil(dueDate, referenceDate) {
  return Math.round((new Date(dueDate).getTime() - new Date(referenceDate).getTime()) / MS_PER_DAY);
}

function detectDueSoon(dueDate, referenceDate, daysBefore) {
  return daysUntil(dueDate, referenceDate) <= daysBefore;
}

function severityForDueSoon(dueDate, referenceDate) {
  return daysUntil(dueDate, referenceDate) < 0 ? 'CRITICAL' : 'WARNING';
}

module.exports = { daysUntil, detectDueSoon, severityForDueSoon };
