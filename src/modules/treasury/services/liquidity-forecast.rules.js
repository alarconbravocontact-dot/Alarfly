const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;

function atUtcMidnight(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Función pura: arma N semanas consecutivas (lunes a domingo, en la
// práctica: 7 días desde `fromDate`) a partir de una fecha de inicio.
function buildWeeklyBuckets(fromDate, numberOfWeeks) {
  const buckets = [];
  let start = atUtcMidnight(fromDate);
  for (let i = 0; i < numberOfWeeks; i++) {
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    buckets.push({ weekStart: new Date(start), weekEnd: new Date(end) });
    start = new Date(end);
    start.setUTCDate(start.getUTCDate() + 1);
  }
  return buckets;
}

// Función pura: reparte una lista de movimientos futuros (signados:
// positivo = entrada, negativo = salida) en las semanas que les
// corresponden por fecha, y calcula el saldo proyectado semana a
// semana arrancando de `startingBalance` (la posición de caja
// consolidada actual, dato real de Tesorería).
function buildLiquidityForecast(startingBalance, buckets, movements) {
  let runningBalance = new Decimal(startingBalance);

  return buckets.map((bucket) => {
    const bucketMovements = movements.filter((m) => m.date >= bucket.weekStart && m.date <= bucket.weekEnd);

    const inflows = bucketMovements
      .filter((m) => new Decimal(m.amount).isPositive())
      .reduce((sum, m) => sum.plus(m.amount), new Decimal(0));
    const outflows = bucketMovements
      .filter((m) => new Decimal(m.amount).isNegative())
      .reduce((sum, m) => sum.plus(new Decimal(m.amount).abs()), new Decimal(0));

    const netChange = inflows.minus(outflows);
    runningBalance = runningBalance.plus(netChange);

    return {
      weekStart: bucket.weekStart,
      weekEnd: bucket.weekEnd,
      expectedInflows: inflows.toFixed(2),
      expectedOutflows: outflows.toFixed(2),
      netChange: netChange.toFixed(2),
      projectedBalance: runningBalance.toFixed(2),
    };
  });
}

// Función pura: la primera semana en la que el saldo proyectado se
// vuelve negativo (o null si nunca pasa en el horizonte calculado) —
// la señal que más le importa a una empresa: "¿cuándo me quedo sin
// caja si no cambio nada?".
function findFirstNegativeWeek(forecastWeeks) {
  return forecastWeeks.find((week) => new Decimal(week.projectedBalance).isNegative()) || null;
}

module.exports = { buildWeeklyBuckets, buildLiquidityForecast, findFirstNegativeWeek };
