const asyncHandler = require('../../../core/utils/asyncHandler');
const liquidityForecastService = require('../services/liquidity-forecast.service');

const getForecast = asyncHandler(async (req, res) => {
  const weeks = req.query.weeks;
  const forecast = await liquidityForecastService.getLiquidityForecast(req.auth.companyId, { weeks });
  res.json(forecast);
});

module.exports = { getForecast };
