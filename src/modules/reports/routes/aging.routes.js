const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { agingQuerySchema } = require('../validators/aging.validator');
const controller = require('../controllers/aging.controller');

const router = Router();

router.get('/aging/receivables', validate(agingQuerySchema, 'query'), controller.receivables);
router.get('/aging/payables', validate(agingQuerySchema, 'query'), controller.payables);

module.exports = router;
