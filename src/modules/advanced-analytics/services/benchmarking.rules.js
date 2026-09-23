const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;

// Función pura: compara un valor real de la empresa contra un valor de
// referencia de industria configurado a mano por el Administrador
// (AnalysisBenchmarkValue) — no hay acceso a datos de industria en
// tiempo real, así que la referencia siempre es manual.
function compareToBenchmark({ actualValue, benchmarkValue }) {
  const actual = new Decimal(actualValue);
  const benchmark = new Decimal(benchmarkValue);
  const variance = actual.minus(benchmark);
  const variancePercent = benchmark.isZero() ? null : variance.dividedBy(benchmark.abs()).times(100);
  return {
    actualValue: actual,
    benchmarkValue: benchmark,
    variance,
    variancePercent,
    isAboveBenchmark: actual.greaterThan(benchmark),
  };
}

module.exports = { compareToBenchmark };
