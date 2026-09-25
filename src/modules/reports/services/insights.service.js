// Fase 12: capa de solo lectura, sin ningún cálculo propio — arma
// insights a partir de servicios que YA EXISTEN (sección 6, fuente
// única de verdad). No crea un motor de inteligencia nuevo; es una
// función más del mismo tipo que ya usa `dashboard.service.js` para
// sus widgets, solo que devuelve una forma más rica (evidencia +
// recomendación) que un simple número.
const prisma = require('../../../core/database/prisma');
const financeSummaryService = require('../../finance/services/finance-summary.service');
const agingService = require('./aging.service');
const coreAlertsService = require('../../../core/alerts/alerts.service');
const { buildLiquidityInsight, buildCollectionsInsight } = require('./insights.rules');

async function getLiquidityInsight(companyId) {
  const summary = await financeSummaryService.getFinanceSummary(companyId);
  return buildLiquidityInsight({
    cashOnHand: summary.cashOnHand,
    overdueReceivable: summary.overdueReceivable,
    firstNegativeWeek: summary.firstNegativeWeek,
    baseCurrency: summary.baseCurrency,
  });
}

async function getCollectionsInsight(companyId) {
  const [aging, company] = await Promise.all([
    agingService.getReceivablesAging(companyId),
    prisma.company.findUnique({ where: { id: companyId }, select: { baseCurrency: true } }),
  ]);
  return buildCollectionsInsight(aging.rows, { baseCurrency: company.baseCurrency });
}

// Fase 12 (secciones 10/12/34, "EVENTO → DETECTOR → INSIGHT → ALERTA"):
// la MISMA detección que ya usa `getLiquidityInsight` para la tarjeta
// del Inicio, ahora también sube una alerta real al motor central
// (`core/alerts`) — Nivel 1 de automatización (sección 13, "solo
// informar"), nunca ejecuta nada. `entityType: 'Company'` porque el
// riesgo de liquidez es de toda la empresa, no de una cuenta puntual
// (a diferencia de LOW_BALANCE/CREDIT_LINE_NEAR_LIMIT). Se agrupa
// dentro del job diario ya existente de Tesorería (`treasury.alerts-
// scan`, ver `treasury/services/alerts.cron.js`) — no se crea un cron
// nuevo solo para esto (sección 12).
async function scanLiquidityRisk(companyId) {
  const insight = await getLiquidityInsight(companyId);
  if (!insight) return [];

  const alert = await coreAlertsService.createAlertIfNotExists({
    companyId,
    ruleId: null,
    type: 'LIQUIDITY_RISK_FORECAST',
    severity: insight.severity,
    message: `${insight.description} (${insight.daysUntilNegative} día(s), ver Previsión de Liquidez).`,
    entityType: 'Company',
    entityId: companyId,
  });
  return alert ? [alert] : [];
}

module.exports = { getLiquidityInsight, getCollectionsInsight, scanLiquidityRisk };
