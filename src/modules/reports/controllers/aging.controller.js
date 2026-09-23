const asyncHandler = require('../../../core/utils/asyncHandler');
const agingService = require('../services/aging.service');

const receivables = asyncHandler(async (req, res) => {
  const report = await agingService.getReceivablesAging(req.auth.companyId, req.query.asOfDate);
  res.json(report);
});

const payables = asyncHandler(async (req, res) => {
  const report = await agingService.getPayablesAging(req.auth.companyId, req.query.asOfDate);
  res.json(report);
});

module.exports = { receivables, payables };
