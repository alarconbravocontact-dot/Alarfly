const asyncHandler = require('../utils/asyncHandler');
const fxService = require('./fx.service');

const listLatestRates = asyncHandler(async (req, res) => {
  const rates = await fxService.getAllLatestRates(req.auth.companyId);
  res.json(rates);
});

module.exports = { listLatestRates };
