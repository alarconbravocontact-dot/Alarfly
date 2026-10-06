const asyncHandler = require('../../../core/utils/asyncHandler');
const dashboardService = require('../services/personal-dashboard.service');

const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await dashboardService.getDashboard(req.auth.companyId);
  res.json(dashboard);
});

module.exports = { getDashboard };
