const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createDebtSchema, amountSchema, listDebtsQuerySchema } = require('../validators/debts.validator');
const controller = require('../controllers/debts.controller');

const router = Router();

const canManage = requireRole('ADMIN');

router.get('/', validate(listDebtsQuerySchema, 'query'), controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createDebtSchema), controller.create);
router.post('/:id/disburse', canManage, controller.disburse);
router.post('/:id/drawdown', canManage, validate(amountSchema), controller.drawdown);
router.post('/:id/repay', canManage, validate(amountSchema), controller.repay);
router.post('/:id/installments/:installmentId/pay', canManage, controller.payInstallment);

module.exports = router;
