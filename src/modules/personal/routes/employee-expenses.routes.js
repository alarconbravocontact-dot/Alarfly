const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const {
  registerExpenseSchema,
  decideExpenseSchema,
  reimburseExpenseSchema,
  listExpensesQuerySchema,
} = require('../validators/employee-expenses.validator');
const controller = require('../controllers/employee-expenses.controller');

const router = Router();

router.get('/', validate(listExpensesQuerySchema, 'query'), controller.list);
router.get('/:id', controller.getOne);
router.post('/', validate(registerExpenseSchema), controller.register);
router.post('/:id/decide', validate(decideExpenseSchema), controller.decide);
router.post('/:id/reimburse', validate(reimburseExpenseSchema), controller.reimburse);

module.exports = router;
