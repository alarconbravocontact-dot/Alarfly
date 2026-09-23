const asyncHandler = require('../../../core/utils/asyncHandler');
const cashFlowService = require('../services/cash-flow.service');

const cashFlow = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const report = await cashFlowService.getCashFlowStatement(req.auth.companyId, { from, to });
  res.json(report);
});

module.exports = { cashFlow };
