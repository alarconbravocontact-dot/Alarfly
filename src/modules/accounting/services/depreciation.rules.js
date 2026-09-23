const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');

const { Decimal } = Prisma;

function clampToRemaining(amount, remaining) {
  const remainingSafe = remaining.isNegative() ? new Decimal(0) : remaining;
  const clamped = Decimal.min(amount, remainingSafe);
  return clamped.isNegative() ? new Decimal(0) : clamped;
}

// Depreciación lineal: el mismo monto cada periodo durante toda la vida útil.
function calculateStraightLine({ purchaseValue, salvageValue, usefulLifeMonths, accumulatedDepreciation }) {
  const depreciableBase = new Decimal(purchaseValue).minus(salvageValue);
  const monthly = depreciableBase.div(usefulLifeMonths);
  const remaining = depreciableBase.minus(accumulatedDepreciation);
  return clampToRemaining(monthly, remaining);
}

// Depreciación acelerada (saldo decreciente doble): un porcentaje fijo
// (2 / vida útil en meses) sobre el valor en libros restante, así que el
// monto es mayor al principio y cada vez más chico.
function calculateDecliningBalance({ purchaseValue, salvageValue, usefulLifeMonths, accumulatedDepreciation }) {
  const rate = new Decimal(2).div(usefulLifeMonths);
  const netBookValue = new Decimal(purchaseValue).minus(accumulatedDepreciation);
  const computed = netBookValue.times(rate);
  const remaining = new Decimal(purchaseValue).minus(salvageValue).minus(accumulatedDepreciation);
  return clampToRemaining(computed, remaining);
}

// Depreciación por unidades de producción: proporcional a cuánto se usó
// el activo en el periodo (ej: kilómetros recorridos), no al tiempo.
function calculateUnitsOfProduction({
  purchaseValue,
  salvageValue,
  totalUnitsOfProduction,
  unitsThisPeriod,
  accumulatedDepreciation,
}) {
  if (!totalUnitsOfProduction || totalUnitsOfProduction <= 0) {
    throw new AppError(
      'Este activo necesita "totalUnitsOfProduction" para depreciarse por unidades de producción.',
      400,
      'MISSING_TOTAL_UNITS'
    );
  }
  const depreciableBase = new Decimal(purchaseValue).minus(salvageValue);
  const perUnit = depreciableBase.div(totalUnitsOfProduction);
  const computed = perUnit.times(unitsThisPeriod || 0);
  const remaining = depreciableBase.minus(accumulatedDepreciation);
  return clampToRemaining(computed, remaining);
}

function calculateDepreciation(method, params) {
  if (method === 'STRAIGHT_LINE') return calculateStraightLine(params);
  if (method === 'DECLINING_BALANCE') return calculateDecliningBalance(params);
  if (method === 'UNITS_OF_PRODUCTION') return calculateUnitsOfProduction(params);
  throw new AppError(`Método de depreciación desconocido: "${method}".`, 400, 'UNKNOWN_METHOD');
}

module.exports = {
  calculateStraightLine,
  calculateDecliningBalance,
  calculateUnitsOfProduction,
  calculateDepreciation,
};
