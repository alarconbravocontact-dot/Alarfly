const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const {
  dateRangeQuerySchema,
  asOfDateQuerySchema,
  compareIncomeStatementQuerySchema,
  compareBalanceSheetQuerySchema,
  transactionsByTypeQuerySchema,
} = require('../validators/financial-statements.validator');
const controller = require('../controllers/financial-statements.controller');

const router = Router();

router.get('/balance-sheet', validate(asOfDateQuerySchema, 'query'), controller.balanceSheet);
router.get('/income-statement', validate(dateRangeQuerySchema, 'query'), controller.incomeStatement);
router.get('/drill-down/:accountId', validate(dateRangeQuerySchema, 'query'), controller.drillDown);
router.get('/transactions-by-type', validate(transactionsByTypeQuerySchema, 'query'), controller.transactionsByType);
router.get('/income-statement/compare', validate(compareIncomeStatementQuerySchema, 'query'), controller.compareIncomeStatement);
router.get('/balance-sheet/compare', validate(compareBalanceSheetQuerySchema, 'query'), controller.compareBalanceSheet);

module.exports = router;
