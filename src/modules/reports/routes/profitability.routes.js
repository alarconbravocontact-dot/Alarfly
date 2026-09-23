const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { profitabilityQuerySchema } = require('../validators/profitability.validator');
const controller = require('../controllers/profitability.controller');

const router = Router();

router.get('/profitability/products', validate(profitabilityQuerySchema, 'query'), controller.byProduct);
router.get('/profitability/clients', validate(profitabilityQuerySchema, 'query'), controller.byClient);

module.exports = router;
