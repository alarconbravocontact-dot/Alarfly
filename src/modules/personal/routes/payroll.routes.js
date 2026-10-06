const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const {
  createPayrollSchema,
  calculatePayrollSchema,
  updatePayrollItemSchema,
  payPayrollSchema,
  listPayrollsQuerySchema,
} = require('../validators/payroll.validator');
const controller = require('../controllers/payroll.controller');

const router = Router();

router.get('/', validate(listPayrollsQuerySchema, 'query'), controller.list);
router.get('/:id', controller.getOne);
router.post('/', validate(createPayrollSchema), controller.create);
router.post('/:id/calculate', validate(calculatePayrollSchema), controller.calculate);
router.patch('/:id/items/:itemId', validate(updatePayrollItemSchema), controller.updateItem);
router.post('/:id/review', controller.review);
router.post('/:id/send-back-to-draft', controller.sendBackToDraft);
router.post('/:id/send-back-to-calculated', controller.sendBackToCalculated);
router.post('/:id/approve', controller.approve);
router.post('/:id/pay', validate(payPayrollSchema), controller.pay);

module.exports = router;
