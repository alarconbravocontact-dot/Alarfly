const asyncHandler = require('../../../core/utils/asyncHandler');
const financeSummaryService = require('../services/finance-summary.service');

const getSummary = asyncHandler(async (req, res) => {
  const summary = await financeSummaryService.getFinanceSummary(req.auth.companyId, req.auth.role);
  res.json(summary);
});

module.exports = { getSummary };
