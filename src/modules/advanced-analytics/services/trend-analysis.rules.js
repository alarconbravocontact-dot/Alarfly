const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;

// Función pura: estadísticas simples de una serie histórica ya
// construida (un punto por periodo, ej. un mes de Estado de
// Resultados) — mismo patrón que ya usa `business-metrics.rules.js`
// para las métricas que el usuario registra a mano, aplicado acá a una
// serie que sale de datos contables reales en vez de datos escritos.
function computeTrendStats(points) {
  if (!points || points.length === 0) {
    return { average: null, min: null, max: null, growthPercent: null };
  }

  const values = points.map((point) => new Decimal(point.value));
  const sum = values.reduce((acc, value) => acc.plus(value), new Decimal(0));
  const average = sum.dividedBy(values.length);
  const min = values.reduce((acc, value) => (value.lessThan(acc) ? value : acc), values[0]);
  const max = values.reduce((acc, value) => (value.greaterThan(acc) ? value : acc), values[0]);

  const first = values[0];
  const last = values[values.length - 1];
  const growthPercent = first.isZero() ? null : last.minus(first).dividedBy(first.abs()).times(100);

  return { average, min, max, growthPercent };
}

module.exports = { computeTrendStats };
