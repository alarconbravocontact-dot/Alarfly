const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');

const { Decimal } = Prisma;

// Función pura: Punto de Equilibrio en moneda (no en unidades, porque
// una empresa puede vender varios productos a la vez — la versión en
// unidades solo tiene sentido para un producto único). Se apoya en la
// clasificación de costo fijo/variable que el usuario define en este
// módulo (ver cost-classification.service.js) sobre cuentas reales de
// Contabilidad (y, cuando el costo de venta viene de Inventario, sobre
// esa misma cuenta ya clasificada como variable).
function calculateBreakEven({ totalRevenue, fixedCosts, variableCosts }) {
  const revenue = new Decimal(totalRevenue);
  const fixed = new Decimal(fixedCosts);
  const variable = new Decimal(variableCosts);

  if (revenue.lessThanOrEqualTo(0)) {
    throw new AppError('No se puede calcular el punto de equilibrio sin ingresos en el periodo.', 400, 'NO_REVENUE');
  }

  const contributionMargin = revenue.minus(variable);
  const contributionMarginRatio = contributionMargin.dividedBy(revenue);

  // Si el margen de contribución es cero o negativo, no existe ningún
  // nivel de venta que alcance el equilibrio (cada venta adicional
  // pierde dinero) — se documenta así en vez de devolver un número
  // engañoso (ej. infinito o negativo).
  const isAchievable = contributionMarginRatio.greaterThan(0);
  const breakEvenRevenue = isAchievable ? fixed.dividedBy(contributionMarginRatio) : null;
  const safetyMarginRevenue = isAchievable ? revenue.minus(breakEvenRevenue) : null;
  const safetyMarginPercent = isAchievable && revenue.greaterThan(0) ? safetyMarginRevenue.dividedBy(revenue).times(100) : null;

  return {
    totalRevenue: revenue,
    fixedCosts: fixed,
    variableCosts: variable,
    contributionMargin,
    contributionMarginRatio,
    isAchievable,
    breakEvenRevenue,
    safetyMarginRevenue,
    safetyMarginPercent,
  };
}

module.exports = { calculateBreakEven };
