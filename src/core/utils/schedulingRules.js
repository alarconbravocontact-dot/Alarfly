const MS_PER_DAY = 24 * 60 * 60 * 1000;

const MIN_INTERVAL_DAYS = { DAILY: 1, WEEKLY: 7, MONTHLY: 28 };

// Función pura: decide si algo programado (un reporte, un análisis
// automático) ya debe volver a correr, comparando cuánto pasó desde la
// última corrida contra el intervalo mínimo de su frecuencia. Nunca
// corrido antes → siempre vencido (se genera la primera vez).
//
// Movido a core porque ahora 2 módulos lo necesitan (Reportes y
// Análisis Avanzados) — regla 1 de la arquitectura maestra.
function isDue(frequency, lastRunAt, now) {
  if (!lastRunAt) return true;
  const minIntervalDays = MIN_INTERVAL_DAYS[frequency];
  const daysSinceLastRun = (now.getTime() - new Date(lastRunAt).getTime()) / MS_PER_DAY;
  return daysSinceLastRun >= minIntervalDays;
}

module.exports = { isDue };
