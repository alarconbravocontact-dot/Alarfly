const asyncHandler = require('../../../core/utils/asyncHandler');
const executiveSummaryService = require('../services/executive-summary.service');

const getSummary = asyncHandler(async (req, res) => {
  res.json(await executiveSummaryService.getExecutiveSummary(req.auth.companyId));
});

module.exports = { getSummary };
