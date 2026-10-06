// Dashboard Ejecutivo Configurable (Reportes punto 6, ampliado en
// Fase 9 para ser el Read Layer del Centro Operativo/Inicio). Cada
// widget solo llama a un servicio que ya existe (Contabilidad/
// Tesorería/FP&A/Finanzas/core/alerts) — este módulo nunca calcula un
// KPI ni un saldo, solo decide qué widgets mostrar, en qué orden y a
// quién, por usuario.
//
// Fase 9: cada widget ganó `roles` (quién puede verlo — filtrado en el
// SERVIDOR, nunca solo ocultado en el frontend, sección 12/40 del
// prompt oficial), `category` (estado/atencion/vision, para que el
// Inicio agrupe visualmente sin tener que hardcodear qué widget va en
// cada capa) y `type` (metric/trend/comparison/alert/forecast, sección
// 35-36). Ningún widget nuevo calcula nada: `finance_summary` y
// `liquidity_forecast` reutilizan exactamente los mismos servicios que
// ya usa la pantalla de Finanzas (Fase 5) y Tesorería.
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const treasuryAccountsService = require('../../treasury/services/treasury-accounts.service');
const kpisService = require('../../fpa/services/kpis.service');
const reportsService = require('../../accounting/services/reports.service');
const alertsService = require('../../../core/alerts/alerts.service');
const financeSummaryService = require('../../finance/services/finance-summary.service');
const liquidityForecastService = require('../../treasury/services/liquidity-forecast.service');
const insightsService = require('./insights.service');
const personalDashboardService = require('../../personal/services/personal-dashboard.service');

// `roles: null` = visible para cualquier rol autenticado (ej. alertas,
// que ya son visibles para todos en la campana de notificaciones desde
// antes de esta fase). Un rol listado explícito es la única fuente de
// verdad de qué widget puede VER cada rol en el Inicio — ADMIN entra
// siempre, igual que en `core/rbac/module-access.js`, sin necesidad de
// listarlo en cada widget.
const WIDGET_DEFINITIONS = [
  {
    key: 'finance_summary',
    label: 'Resumen Financiero',
    category: 'estado',
    type: 'metric',
    roles: ['ADMIN', 'ACCOUNTANT', 'FINANCE'],
    compute: async (companyId) => financeSummaryService.getFinanceSummary(companyId),
  },
  {
    key: 'cash_position',
    label: 'Posición de Caja Consolidada',
    category: 'estado',
    type: 'metric',
    roles: ['ADMIN', 'ACCOUNTANT', 'FINANCE'],
    compute: async (companyId) => treasuryAccountsService.getConsolidatedCashPosition(companyId),
  },
  {
    key: 'ebitda',
    label: 'EBITDA',
    category: 'estado',
    type: 'metric',
    roles: ['ADMIN', 'FINANCE'],
    compute: async (companyId, { from, to }) => kpisService.getEbitda(companyId, { from, to }),
  },
  {
    key: 'burn_rate_runway',
    label: 'Burn Rate y Runway',
    category: 'estado',
    type: 'metric',
    roles: ['ADMIN', 'FINANCE'],
    compute: async (companyId, { from, to }) => kpisService.getBurnRateAndRunway(companyId, { from, to }),
  },
  {
    key: 'income_statement_summary',
    label: 'Estado de Resultados (resumen)',
    category: 'estado',
    type: 'comparison',
    roles: ['ADMIN', 'ACCOUNTANT', 'FINANCE'],
    compute: async (companyId, { from, to }) => {
      const report = await reportsService.getIncomeStatement(companyId, { from, to });
      return { totalIncome: report.totalIncome, totalExpense: report.totalExpense, netIncome: report.netIncome };
    },
  },
  {
    key: 'balance_sheet_summary',
    label: 'Balance General (resumen)',
    category: 'estado',
    type: 'metric',
    roles: ['ADMIN', 'ACCOUNTANT', 'FINANCE'],
    compute: async (companyId, { asOfDate }) => {
      const report = await reportsService.getBalanceSheet(companyId, asOfDate);
      return {
        totalAssets: report.totalAssets,
        totalLiabilities: report.totalLiabilities,
        totalEquity: report.totalEquity,
        netIncomeToDate: report.netIncomeToDate,
      };
    },
  },
  // Fase 9: la Previsión de Liquidez ya existente de Tesorería (punto 5,
  // semana a semana con AR/AP/deuda/órdenes de pago reales) expuesta
  // como widget del Inicio — sin recalcular nada, ni un segundo
  // forecast; es el mismo `firstNegativeWeek` que ya usa Finance
  // Summary.
  {
    key: 'liquidity_forecast',
    label: 'Previsión de Liquidez (8 semanas)',
    category: 'vision',
    type: 'forecast',
    roles: ['ADMIN', 'ACCOUNTANT', 'FINANCE'],
    compute: async (companyId) => liquidityForecastService.getLiquidityForecast(companyId, { weeks: 8 }),
  },
  // Fase 12 (Centro Operativo Inteligente, secciones 5/8/19): dos
  // "insights" — detección + evidencia + recomendación, no solo un
  // número — que envuelven `reports/services/insights.service.js`
  // (que a su vez reutiliza finance-summary/aging, sin recalcular
  // nada). Se devuelve `null` cuando no hay nada que reportar (ej. sin
  // riesgo de liquidez) — el widget category `atencion` ya sabe
  // ocultar una tarjeta sin datos, mismo criterio que `active_alerts`.
  {
    key: 'liquidity_insight',
    label: 'Insight de Liquidez',
    category: 'atencion',
    type: 'insight',
    roles: ['ADMIN', 'ACCOUNTANT', 'FINANCE'],
    compute: async (companyId) => insightsService.getLiquidityInsight(companyId),
  },
  {
    key: 'collections_insight',
    label: 'Insight de Cobranza',
    category: 'atencion',
    type: 'insight',
    roles: ['ADMIN', 'ACCOUNTANT', 'FINANCE'],
    compute: async (companyId) => insightsService.getCollectionsInsight(companyId),
  },
  // "Requiere tu atención": envuelve el motor de alertas central ya
  // existente (core/alerts), nunca un segundo motor — mismo criterio ya
  // documentado ("el Dashboard debe consumir las alertas, no crear
  // dashboardAlerts.service.js"). Sin `roles`: visible para cualquier
  // rol, igual que la campana de notificaciones del topbar.
  // Integración de Personal con el Inicio (Dashboard/Panel principal):
  // los mismos 6 números que ya muestra Personal > Resumen
  // (`personal-dashboard.service.getDashboard`, sin recalcular nada),
  // registrados como UN widget más — el usuario decide si lo quiere
  // ver, igual que cualquier otro widget de esta lista (nunca forzado).
  // `roles` calza con `core/rbac/module-access.js` (`personal:
  // ['ADMIN','FINANCE']`) para no ofrecerle a un rol sin acceso un
  // widget que la API de todas formas le va a negar.
  {
    key: 'personal_summary',
    label: 'Personal',
    category: 'estado',
    type: 'metric',
    roles: ['ADMIN', 'FINANCE'],
    compute: async (companyId) => personalDashboardService.getDashboard(companyId),
  },
  {
    key: 'active_alerts',
    label: 'Requiere tu Atención',
    category: 'atencion',
    type: 'alert',
    roles: null,
    compute: async (companyId) => {
      const alerts = await alertsService.listAlerts(companyId, { status: 'ACTIVE' });
      return { count: alerts.length, alerts: alerts.slice(0, 10) };
    },
  },
];

const WIDGET_KEYS = WIDGET_DEFINITIONS.map((w) => w.key);

function widgetVisibleForRole(widget, role) {
  return role === 'ADMIN' || !widget.roles || widget.roles.includes(role);
}

function definitionsForRole(role) {
  return WIDGET_DEFINITIONS.filter((w) => widgetVisibleForRole(w, role));
}

function listAvailableWidgets(role) {
  return definitionsForRole(role).map(({ key, label, category, type }) => ({ key, label, category, type }));
}

// Combina lo que el usuario guardó (DashboardWidgetPreference) con el
// registro de widgets disponibles PARA SU ROL: un widget nuevo que el
// usuario nunca configuró aparece visible por defecto, en el orden del
// registro — y un widget que su rol no puede ver ni siquiera aparece en
// esta lista, para que el modo de edición del Inicio nunca le ofrezca
// activar algo que la API le va a negar de todas formas.
async function getWidgetPreferences(companyId, userId, role) {
  const saved = await prisma.dashboardWidgetPreference.findMany({ where: { companyId, userId } });
  const savedByKey = new Map(saved.map((p) => [p.widgetKey, p]));
  const definitions = definitionsForRole(role);

  return definitions
    .map((widget, index) => {
      const pref = savedByKey.get(widget.key);
      return {
        widgetKey: widget.key,
        label: widget.label,
        category: widget.category,
        type: widget.type,
        isVisible: pref ? pref.isVisible : true,
        order: pref ? pref.order : index,
      };
    })
    .sort((a, b) => a.order - b.order);
}

async function setWidgetPreference(companyId, userId, role, widgetKey, { isVisible, order }) {
  if (!WIDGET_KEYS.includes(widgetKey) || !widgetVisibleForRole(WIDGET_DEFINITIONS.find((w) => w.key === widgetKey), role)) {
    throw new AppError('El widget indicado no existe.', 400, 'WIDGET_NOT_FOUND');
  }

  return prisma.dashboardWidgetPreference.upsert({
    where: { userId_widgetKey: { userId, widgetKey } },
    update: {
      isVisible: isVisible === undefined ? undefined : isVisible,
      order: order === undefined ? undefined : order,
    },
    create: {
      companyId,
      userId,
      widgetKey,
      isVisible: isVisible === undefined ? true : isVisible,
      order: order === undefined ? 0 : order,
    },
  });
}

// "Restaurar configuración predeterminada" (sección 38 del prompt de
// Fase 9): borra ÚNICAMENTE las preferencias de widgets de ESTE
// usuario — nunca toca datos, operaciones ni configuración de empresa.
async function resetWidgetPreferences(userId) {
  await prisma.dashboardWidgetPreference.deleteMany({ where: { userId } });
}

async function getDashboard(companyId, userId, role, { from, to, asOfDate }) {
  const preferences = await getWidgetPreferences(companyId, userId, role);
  const visible = preferences.filter((p) => p.isVisible);

  const widgets = await Promise.all(
    visible.map(async (pref) => {
      const definition = WIDGET_DEFINITIONS.find((w) => w.key === pref.widgetKey);
      const data = await definition.compute(companyId, { from, to, asOfDate });
      return { widgetKey: pref.widgetKey, label: pref.label, category: pref.category, type: pref.type, order: pref.order, data };
    })
  );

  return { widgets };
}

module.exports = {
  listAvailableWidgets,
  getWidgetPreferences,
  setWidgetPreference,
  resetWidgetPreferences,
  getDashboard,
};
