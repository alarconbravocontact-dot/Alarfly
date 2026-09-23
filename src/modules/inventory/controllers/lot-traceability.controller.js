const asyncHandler = require('../../../core/utils/asyncHandler');
const lotTraceabilityService = require('../services/lot-traceability.service');

const list = asyncHandler(async (req, res) => {
  const lots = await lotTraceabilityService.listLots(req.auth.companyId, req.query);
  res.json(lots);
});

const getTrace = asyncHandler(async (req, res) => {
  const trace = await lotTraceabilityService.getLotTrace(req.auth.companyId, req.params.id);
  res.json(trace);
});

module.exports = { list, getTrace };
