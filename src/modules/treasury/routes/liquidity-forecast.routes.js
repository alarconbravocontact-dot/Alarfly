const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { liquidityForecastQuerySchema } = require('../validators/liquidity-forecast.validator');
const controller = require('../controllers/liquidity-forecast.controller');

const router = Router();

router.get('/', validate(liquidityForecastQuerySchema, 'query'), controller.getForecast);

module.exports = router;
