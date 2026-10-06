const asyncHandler = require('../../../core/utils/asyncHandler');
const dashboardService = require('../services/personal-dashboard.service');

const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await dashboardService.getDashboard(req.auth.companyId);
  res.json(dashboard);
});

// "Evolución del costo de personal" (Analítica, sección 4 del pedido de
// integración): mismo criterio que `GET /accounts-receivable/invoices/sales-trend`.
const getCostTrend = asyncHandler(async (req, res) => {
  const months = req.query.months ? Number(req.query.months) : 6;
  const trend = await dashboardService.getCostTrend(req.auth.companyId, months);
  res.json(trend);
});

module.exports = { getDashboard, getCostTrend };
