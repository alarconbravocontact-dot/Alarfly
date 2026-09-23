const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');

const { Decimal } = Prisma;

// Función pura: descompone el ROE (Retorno sobre el Patrimonio) en sus
// 3 factores clásicos del análisis DuPont:
//   Margen Neto        = Utilidad Neta / Ingresos       (qué tan bien vendes)
//   Rotación de Activos = Ingresos / Activos Totales     (qué tan bien usas lo que tienes)
//   Multiplicador de Patrimonio = Activos Totales / Patrimonio (cuánta deuda usas)
//   ROE = Margen Neto × Rotación de Activos × Multiplicador de Patrimonio
function calculateDupont({ netIncome, revenue, totalAssets, totalEquity }) {
  const income = new Decimal(netIncome);
  const rev = new Decimal(revenue);
  const assets = new Decimal(totalAssets);
  const equity = new Decimal(totalEquity);

  if (rev.lessThanOrEqualTo(0)) {
    throw new AppError('No se puede descomponer el ROE sin ingresos en el periodo.', 400, 'NO_REVENUE');
  }
  if (assets.lessThanOrEqualTo(0)) {
    throw new AppError('No se puede descomponer el ROE sin activos en el periodo.', 400, 'NO_ASSETS');
  }
  if (equity.lessThanOrEqualTo(0)) {
    throw new AppError('No se puede descomponer el ROE con patrimonio en cero o negativo.', 400, 'NO_EQUITY');
  }

  const netProfitMargin = income.dividedBy(rev);
  const assetTurnover = rev.dividedBy(assets);
  const equityMultiplier = assets.dividedBy(equity);
  const roe = netProfitMargin.times(assetTurnover).times(equityMultiplier);

  return { netProfitMargin, assetTurnover, equityMultiplier, roe };
}

module.exports = { calculateDupont };
