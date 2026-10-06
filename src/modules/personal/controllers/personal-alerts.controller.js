const asyncHandler = require('../../../core/utils/asyncHandler');
const personalAlertsService = require('../services/personal-alerts.service');

const scan = asyncHandler(async (req, res) => {
  const created = await personalAlertsService.scanPendingActions(req.auth.companyId);
  res.json({ createdCount: created.length, alerts: created });
});

module.exports = { scan };
