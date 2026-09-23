const asyncHandler = require('../../../core/utils/asyncHandler');
const fxService = require('../../../core/fx/fx.service');

const recordRate = asyncHandler(async (req, res) => {
  const rate = await fxService.recordRate({ companyId: req.auth.companyId, ...req.body });
  res.status(201).json(rate);
});

const listRates = asyncHandler(async (req, res) => {
  const rates = await fxService.listRates(req.auth.companyId, req.query.currency);
  res.json(rates);
});

const revalue = asyncHandler(async (req, res) => {
  const entries = await fxService.revalueCompany(req.auth.companyId, req.body.asOfDate, req.auth.userId);
  res.status(201).json({ entriesPosted: entries.length, entries });
});

module.exports = { recordRate, listRates, revalue };
