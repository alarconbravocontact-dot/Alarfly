const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const {
  dateRangeQuerySchema,
  asOfDateQuerySchema,
  compareIncomeStatementQuerySchema,
  compareBalanceSheetQuerySchema,
} = require('../validators/reports.validator');
const controller = require('../controllers/reports.controller');

const router = Router();

router.get('/general-ledger/:accountId', validate(dateRangeQuerySchema, 'query'), controller.generalLedger);
router.get('/trial-balance', validate(asOfDateQuerySchema, 'query'), controller.trialBalance);
router.get('/income-statement', validate(dateRangeQuerySchema, 'query'), controller.incomeStatement);
router.get('/balance-sheet', validate(asOfDateQuerySchema, 'query'), controller.balanceSheet);
router.get(
  '/income-statement/compare',
  validate(compareIncomeStatementQuerySchema, 'query'),
  controller.compareIncomeStatement
);
router.get(
  '/balance-sheet/compare',
  validate(compareBalanceSheetQuerySchema, 'query'),
  controller.compareBalanceSheet
);

module.exports = router;
