const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;

// División segura: si el denominador es cero, devuelve null en vez de
// lanzar un error — a diferencia de otros análisis de este módulo, acá
// un ratio individual sin sentido (ej. sin inventario para calcular
// rotación) no debe tumbar el cálculo de los otros 8 ratios.
function safeDivide(numerator, denominator) {
  const denom = new Decimal(denominator);
  if (denom.isZero()) return null;
  return new Decimal(numerator).dividedBy(denom);
}

// Función pura: calcula los ratios clásicos de las 5 categorías de
// análisis financiero, agrupados. Todos los montos de entrada ya
// existen en Contabilidad (Balance General, Estado de Resultados) — acá
// solo se combinan en fórmulas, nunca se recalculan.
function calculateFinancialRatios({
  currentAssets,
  currentLiabilities,
  inventory,
  totalAssets,
  totalLiabilities,
  totalEquity,
  netIncome,
  revenue,
  cogs,
  averageInventory,
}) {
  const quickAssets = new Decimal(currentAssets).minus(inventory || 0);

  return {
    liquidity: {
      currentRatio: safeDivide(currentAssets, currentLiabilities),
      quickRatio: safeDivide(quickAssets, currentLiabilities),
    },
    solvency: {
      debtRatio: safeDivide(totalLiabilities, totalAssets),
      debtToEquityRatio: safeDivide(totalLiabilities, totalEquity),
    },
    profitability: {
      netMargin: safeDivide(netIncome, revenue),
      returnOnAssets: safeDivide(netIncome, totalAssets),
      returnOnEquity: safeDivide(netIncome, totalEquity),
    },
    activity: {
      assetTurnover: safeDivide(revenue, totalAssets),
      inventoryTurnover: safeDivide(cogs, averageInventory),
    },
    // No hay cotización bursátil en un sistema pensado para pymes
    // privadas — como aproximación honesta, "valuación" acá se limita
    // al valor en libros (patrimonio), documentado explícitamente en
    // la metodología del análisis, no un múltiplo de mercado inventado.
    valuation: {
      bookValue: new Decimal(totalEquity),
    },
  };
}

module.exports = { calculateFinancialRatios, safeDivide };
