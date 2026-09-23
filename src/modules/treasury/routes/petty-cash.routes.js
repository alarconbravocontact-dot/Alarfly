const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const {
  createFundSchema,
  listFundsQuerySchema,
  registerExpenseSchema,
  decideExpenseSchema,
  bulkDecideExpensesSchema,
  listExpensesQuerySchema,
  replenishSchema,
} = require('../validators/petty-cash.validator');
const controller = require('../controllers/petty-cash.controller');

const router = Router();

const canManage = requireRole('ADMIN', 'COLLABORATOR');
const canApprove = requireRole('ADMIN');

router.get('/funds', validate(listFundsQuerySchema, 'query'), controller.listFunds);
router.get('/funds/:id', controller.getFund);
router.post('/funds', canManage, validate(createFundSchema), controller.createFund);
router.post('/funds/:id/replenish', canManage, validate(replenishSchema), controller.replenish);

router.get('/expenses', validate(listExpensesQuerySchema, 'query'), controller.listExpenses);
router.post('/expenses', validate(registerExpenseSchema), controller.registerExpense);
router.post('/expenses/:id/decide', canApprove, validate(decideExpenseSchema), controller.decideExpense);
router.post('/expenses/bulk-decide', canApprove, validate(bulkDecideExpensesSchema), controller.bulkDecideExpenses);

module.exports = router;
