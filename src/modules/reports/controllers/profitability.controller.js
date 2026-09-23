const asyncHandler = require('../../../core/utils/asyncHandler');
const profitabilityService = require('../services/profitability.service');

const byProduct = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const report = await profitabilityService.getProductProfitability(req.auth.companyId, { from, to });
  res.json(report);
});

const byClient = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const report = await profitabilityService.getClientProfitability(req.auth.companyId, { from, to });
  res.json(report);
});

module.exports = { byProduct, byClient };
