const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { dateRangeQuerySchema } = require('../validators/fiscal-books.validator');
const controller = require('../controllers/fiscal-books.controller');

const router = Router();

router.get('/sales', validate(dateRangeQuerySchema, 'query'), controller.salesBook);
router.get('/purchases', validate(dateRangeQuerySchema, 'query'), controller.purchasesBook);
router.get('/withholdings', validate(dateRangeQuerySchema, 'query'), controller.withholdingsSummary);
router.get('/reconciliation/:periodId', controller.reconcilePeriod);

module.exports = router;
