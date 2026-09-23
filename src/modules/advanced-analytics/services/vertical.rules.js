const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;

// Función pura: Análisis Vertical — dado un conjunto de filas
// {code, name, amount} (las mismas que ya devuelve el Balance General o
// el Estado de Resultados de Contabilidad, sin recalcular nada) y una
// base (total de activos o total de ingresos), calcula qué porcentaje
// de esa base representa cada fila.
function calculateVerticalAnalysis(rows, baseAmount) {
  const base = new Decimal(baseAmount);
  return rows.map((row) => ({
    ...row,
    percentOfBase: base.isZero() ? new Decimal(0) : new Decimal(row.amount).dividedBy(base).times(100),
  }));
}

module.exports = { calculateVerticalAnalysis };
