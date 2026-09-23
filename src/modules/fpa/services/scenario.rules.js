const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');

const { Decimal } = Prisma;

const SUPPORTED_ADJUSTMENT_TYPES = ['RECURRING_EXPENSE', 'SALES_VARIATION', 'NEW_HIRE'];

// Función pura (sin base de datos, sin ningún efecto secundario): dado
// un punto de partida real (ingresos y gastos mensuales) y una lista de
// ajustes hipotéticos, calcula el P&L mensual proyectado. Nunca escribe
// nada — solo calcula y devuelve un resultado; guardar el escenario
// (si el usuario lo pide) es una función aparte que sí toca la base de
// datos (ver scenarios.service.js).
function projectScenario({ baselineMonthlyRevenue, baselineMonthlyExpenses, adjustments = [], projectionMonths }) {
  if (!projectionMonths || projectionMonths < 1) {
    throw new AppError('Debes indicar cuántos meses proyectar (projectionMonths >= 1).', 400, 'INVALID_PROJECTION_MONTHS');
  }

  let revenue = new Decimal(baselineMonthlyRevenue);
  let expenses = new Decimal(baselineMonthlyExpenses);

  for (const adjustment of adjustments) {
    if (!SUPPORTED_ADJUSTMENT_TYPES.includes(adjustment.type)) {
      throw new AppError(`Tipo de ajuste no soportado: "${adjustment.type}".`, 400, 'UNSUPPORTED_ADJUSTMENT_TYPE');
    }
    if (adjustment.type === 'RECURRING_EXPENSE') {
      expenses = expenses.plus(adjustment.monthlyAmount);
    } else if (adjustment.type === 'NEW_HIRE') {
      expenses = expenses.plus(adjustment.monthlyCost);
    } else if (adjustment.type === 'SALES_VARIATION') {
      revenue = revenue.plus(revenue.times(adjustment.percentage).dividedBy(100));
    }
  }

  const baselineMonthlyNetIncome = new Decimal(baselineMonthlyRevenue).minus(baselineMonthlyExpenses);
  const projectedMonthlyNetIncome = revenue.minus(expenses);
  const monthlyNetIncomeDelta = projectedMonthlyNetIncome.minus(baselineMonthlyNetIncome);

  return {
    baselineMonthlyNetIncome,
    projectedMonthlyRevenue: revenue,
    projectedMonthlyExpenses: expenses,
    projectedMonthlyNetIncome,
    monthlyNetIncomeDelta,
    cumulativeNetIncomeDelta: monthlyNetIncomeDelta.times(projectionMonths),
    projectionMonths,
  };
}

// Función pura: aplica el impacto de un escenario (delta mensual de
// utilidad neta ya calculado por projectScenario) sobre la Previsión de
// Liquidez real semana a semana de Tesorería (liquidity-forecast.service,
// punto 5 de Tesorería). Convierte el delta mensual a semanal asumiendo
// un mes de 30 días (misma simplificación que ya usa el resto del
// proyecto para cálculos aproximados de fecha), y lo acumula semana a
// semana sobre el saldo YA proyectado con datos reales (AR/AP/deuda/
// órdenes de pago) — nunca reemplaza esos datos reales, solo les suma
// el efecto hipotético del escenario.
function applyScenarioToLiquidityForecast(baselineForecastWeeks, monthlyNetIncomeDelta) {
  const weeklyDelta = new Decimal(monthlyNetIncomeDelta).times(7).dividedBy(30);
  let cumulativeDelta = new Decimal(0);

  return baselineForecastWeeks.map((week) => {
    cumulativeDelta = cumulativeDelta.plus(weeklyDelta);
    return {
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      scenarioNetChangeFromBaseline: weeklyDelta.toFixed(2),
      scenarioProjectedBalance: new Decimal(week.projectedBalance).plus(cumulativeDelta).toFixed(2),
    };
  });
}

// Función pura: primera semana en la que el saldo proyectado CON el
// escenario aplicado se vuelve negativo — mismo criterio que
// findFirstNegativeWeek de Tesorería, pero sobre la curva ajustada.
function findFirstNegativeScenarioWeek(scenarioForecastWeeks) {
  return scenarioForecastWeeks.find((week) => new Decimal(week.scenarioProjectedBalance).isNegative()) || null;
}

module.exports = {
  projectScenario,
  applyScenarioToLiquidityForecast,
  findFirstNegativeScenarioWeek,
  SUPPORTED_ADJUSTMENT_TYPES,
};
