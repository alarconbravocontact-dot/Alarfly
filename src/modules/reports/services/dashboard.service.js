// Dashboard Ejecutivo Configurable (punto 6). Cada widget solo llama a
// un servicio que ya existe (Contabilidad/Tesorería/FP&A/core/alerts) —
// este módulo nunca calcula un KPI ni un saldo, solo decide qué
// widgets mostrar y en qué orden, por usuario.
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const treasuryAccountsService = require('../../treasury/services/treasury-accounts.service');
const kpisService = require('../../fpa/services/kpis.service');
const reportsService = require('../../accounting/services/reports.service');
const alertsService = require('../../../core/alerts/alerts.service');

// Registro de widgets disponibles: agregar uno nuevo es agregar una
// entrada aquí, sin tocar el resto (mismo patrón adapter que ya se usó
// en Tesorería para parsers/exportadores y en Fiscal para proveedores
// de facturación electrónica).
const WIDGET_DEFINITIONS = [
  {
    key: 'cash_position',
    label: 'Posición de Caja Consolidada',
    compute: async (companyId) => treasuryAccountsService.getConsolidatedCashPosition(companyId),
  },
  {
    key: 'ebitda',
    label: 'EBITDA',
    compute: async (companyId, { from, to }) => kpisService.getEbitda(companyId, { from, to }),
  },
  {
    key: 'burn_rate_runway',
    label: 'Burn Rate y Runway',
    compute: async (companyId, { from, to }) => kpisService.getBurnRateAndRunway(companyId, { from, to }),
  },
  {
    key: 'income_statement_summary',
    label: 'Estado de Resultados (resumen)',
    compute: async (companyId, { from, to }) => {
      const report = await reportsService.getIncomeStatement(companyId, { from, to });
      return { totalIncome: report.totalIncome, totalExpense: report.totalExpense, netIncome: report.netIncome };
    },
  },
  {
    key: 'balance_sheet_summary',
    label: 'Balance General (resumen)',
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
  {
    key: 'active_alerts',
    label: 'Alertas Activas',
    compute: async (companyId) => {
      const alerts = await alertsService.listAlerts(companyId, { status: 'ACTIVE' });
      return { count: alerts.length, alerts: alerts.slice(0, 10) };
    },
  },
];

const WIDGET_KEYS = WIDGET_DEFINITIONS.map((w) => w.key);

function listAvailableWidgets() {
  return WIDGET_DEFINITIONS.map(({ key, label }) => ({ key, label }));
}

// Combina lo que el usuario guardó (DashboardWidgetPreference) con el
// registro de widgets disponibles: un widget nuevo que el usuario nunca
// configuró aparece visible por defecto, en el orden del registro.
async function getWidgetPreferences(companyId, userId) {
  const saved = await prisma.dashboardWidgetPreference.findMany({ where: { companyId, userId } });
  const savedByKey = new Map(saved.map((p) => [p.widgetKey, p]));

  return WIDGET_DEFINITIONS.map((widget, index) => {
    const pref = savedByKey.get(widget.key);
    return {
      widgetKey: widget.key,
      label: widget.label,
      isVisible: pref ? pref.isVisible : true,
      order: pref ? pref.order : index,
    };
  }).sort((a, b) => a.order - b.order);
}

async function setWidgetPreference(companyId, userId, widgetKey, { isVisible, order }) {
  if (!WIDGET_KEYS.includes(widgetKey)) {
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

async function getDashboard(companyId, userId, { from, to, asOfDate }) {
  const preferences = await getWidgetPreferences(companyId, userId);
  const visible = preferences.filter((p) => p.isVisible);

  const widgets = await Promise.all(
    visible.map(async (pref) => {
      const definition = WIDGET_DEFINITIONS.find((w) => w.key === pref.widgetKey);
      const data = await definition.compute(companyId, { from, to, asOfDate });
      return { widgetKey: pref.widgetKey, label: pref.label, order: pref.order, data };
    })
  );

  return { widgets };
}

module.exports = { listAvailableWidgets, getWidgetPreferences, setWidgetPreference, getDashboard };
