const asyncHandler = require('../../../core/utils/asyncHandler');
const dashboardService = require('../services/dashboard.service');

function defaultRange(query) {
  const to = query.to || new Date();
  const from = query.from || new Date(to.getFullYear(), to.getMonth(), 1);
  const asOfDate = query.asOfDate || to;
  return { from, to, asOfDate };
}

const listWidgets = asyncHandler(async (req, res) => {
  res.json(dashboardService.listAvailableWidgets());
});

const getPreferences = asyncHandler(async (req, res) => {
  const preferences = await dashboardService.getWidgetPreferences(req.auth.companyId, req.auth.userId);
  res.json(preferences);
});

const setPreference = asyncHandler(async (req, res) => {
  const updated = await dashboardService.setWidgetPreference(req.auth.companyId, req.auth.userId, req.params.widgetKey, req.body);
  res.json(updated);
});

const getDashboard = asyncHandler(async (req, res) => {
  const range = defaultRange(req.query);
  const dashboard = await dashboardService.getDashboard(req.auth.companyId, req.auth.userId, range);
  res.json(dashboard);
});

module.exports = { listWidgets, getPreferences, setPreference, getDashboard };
