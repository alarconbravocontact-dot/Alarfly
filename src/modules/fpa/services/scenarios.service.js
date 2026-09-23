const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const reportsService = require('../../accounting/services/reports.service');
const liquidityForecastService = require('../../treasury/services/liquidity-forecast.service');
const { projectScenario, applyScenarioToLiquidityForecast, findFirstNegativeScenarioWeek } = require('./scenario.rules');

const { Decimal } = Prisma;

function monthsBetweenInclusive(from, to) {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth()) + 1;
}

// Calcula el impacto proyectado (P&L y caja) de un escenario
// hipotético. Es de solo lectura: consulta Contabilidad (línea base
// real) y Tesorería (posición de caja actual), pero NUNCA escribe un
// asiento ni cambia ningún saldo. Guardar el resultado es una acción
// aparte y explícita (ver saveScenario).
async function simulateScenario(companyId, { baselineFrom, baselineTo, adjustments, projectionMonths, weeks }) {
  const incomeStatement = await reportsService.getIncomeStatement(companyId, { from: baselineFrom, to: baselineTo });
  const months = monthsBetweenInclusive(baselineFrom, baselineTo);

  const baselineMonthlyRevenue = new Decimal(incomeStatement.totalIncome).dividedBy(months);
  const baselineMonthlyExpenses = new Decimal(incomeStatement.totalExpense).dividedBy(months);

  const projection = projectScenario({
    baselineMonthlyRevenue,
    baselineMonthlyExpenses,
    adjustments,
    projectionMonths,
  });

  // Ya no es una aproximación con la caja actual: usa la Previsión de
  // Liquidez real de Tesorería (punto 5, semana a semana con AR/AP/
  // deuda/órdenes de pago reales) como línea base, y le suma encima el
  // impacto semanal del escenario (ver applyScenarioToLiquidityForecast).
  const forecastWeeks = weeks || Math.min(Math.max(Math.ceil(projectionMonths * (30 / 7)), 4), 52);
  const liquidityForecast = await liquidityForecastService.getLiquidityForecast(companyId, { weeks: forecastWeeks });
  const scenarioForecastWeeks = applyScenarioToLiquidityForecast(liquidityForecast.weeks, projection.monthlyNetIncomeDelta);

  return {
    baseline: {
      from: baselineFrom,
      to: baselineTo,
      months,
      monthlyRevenue: baselineMonthlyRevenue.toFixed(2),
      monthlyExpenses: baselineMonthlyExpenses.toFixed(2),
      monthlyNetIncome: projection.baselineMonthlyNetIncome.toFixed(2),
    },
    projection: {
      projectionMonths,
      projectedMonthlyRevenue: projection.projectedMonthlyRevenue.toFixed(2),
      projectedMonthlyExpenses: projection.projectedMonthlyExpenses.toFixed(2),
      projectedMonthlyNetIncome: projection.projectedMonthlyNetIncome.toFixed(2),
      monthlyNetIncomeDelta: projection.monthlyNetIncomeDelta.toFixed(2),
      cumulativeNetIncomeDelta: projection.cumulativeNetIncomeDelta.toFixed(2),
    },
    liquidity: {
      note:
        'Previsión de liquidez real semana a semana (Tesorería punto 5, con facturas de clientes/proveedores, cuotas de deuda y órdenes de pago pendientes reales), ajustada con el impacto de este escenario repartido semanalmente.',
      startingBalance: liquidityForecast.startingBalance,
      baselineWeeks: liquidityForecast.weeks,
      scenarioWeeks: scenarioForecastWeeks,
      firstNegativeWeekBaseline: liquidityForecast.firstNegativeWeek,
      firstNegativeWeekScenario: findFirstNegativeScenarioWeek(scenarioForecastWeeks),
    },
  };
}

// Guarda un escenario ya simulado como referencia (borrador). No aplica
// nada a los libros: es literalmente guardar el input y el output de
// simulateScenario para poder consultarlos después.
async function saveScenario(companyId, userId, { name, description, parameters, projectedResult }) {
  return prisma.$transaction(async (tx) => {
    const scenario = await tx.whatIfScenario.create({
      data: { companyId, name, description: description || null, parameters, projectedResult, createdByUserId: userId },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'what_if_scenario.saved',
        entityType: 'WhatIfScenario',
        entityId: scenario.id,
        oldValue: null,
        newValue: scenario,
      },
      tx
    );
    return scenario;
  });
}

async function listScenarios(companyId) {
  return prisma.whatIfScenario.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
}

async function getScenario(companyId, id) {
  const scenario = await prisma.whatIfScenario.findFirst({ where: { id, companyId } });
  if (!scenario) {
    throw new AppError('El escenario indicado no existe.', 404, 'SCENARIO_NOT_FOUND');
  }
  return scenario;
}

module.exports = { simulateScenario, saveScenario, listScenarios, getScenario };
