const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;

// Función pura: dada la serie de valores que el usuario fue
// registrando para una métrica (ya ordenada por fecha, más vieja
// primero), calcula estadísticas simples — nunca toca la base de
// datos, así se puede probar sin Postgres.
function computeMetricStats(entries) {
  if (entries.length === 0) {
    return { count: 0, first: null, latest: null, average: null, min: null, max: null, total: null, change: null };
  }

  let total = new Decimal(0);
  let min = entries[0];
  let max = entries[0];

  for (const entry of entries) {
    const value = new Decimal(entry.value);
    total = total.plus(value);
    if (value.lessThan(min.value)) min = entry;
    if (value.greaterThan(max.value)) max = entry;
  }

  const average = total.dividedBy(entries.length);
  const first = entries[0];
  const latest = entries[entries.length - 1];

  const firstValue = new Decimal(first.value);
  const latestValue = new Decimal(latest.value);
  const variance = latestValue.minus(firstValue);
  const variancePercent = firstValue.isZero() ? null : variance.dividedBy(firstValue).times(100).toDecimalPlaces(2);

  return {
    count: entries.length,
    first: { date: first.date, value: firstValue.toFixed(4) },
    latest: { date: latest.date, value: latestValue.toFixed(4) },
    average: average.toFixed(4),
    min: { date: min.date, value: new Decimal(min.value).toFixed(4) },
    max: { date: max.date, value: new Decimal(max.value).toFixed(4) },
    total: total.toFixed(4),
    change: { variance: variance.toFixed(4), variancePercent: variancePercent === null ? null : variancePercent.toFixed(2) },
  };
}

module.exports = { computeMetricStats };
