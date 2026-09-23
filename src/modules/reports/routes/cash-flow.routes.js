const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { cashFlowQuerySchema } = require('../validators/cash-flow.validator');
const controller = require('../controllers/cash-flow.controller');

const router = Router();

router.get('/cash-flow', validate(cashFlowQuerySchema, 'query'), controller.cashFlow);

module.exports = router;
