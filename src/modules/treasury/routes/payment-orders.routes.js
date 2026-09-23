const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const {
  createPaymentOrderSchema,
  createPaymentOrderForVendorBillsSchema,
  decideApprovalSchema,
  listPaymentOrdersQuerySchema,
} = require('../validators/payment-orders.validator');
const controller = require('../controllers/payment-orders.controller');

const router = Router();

const canManage = requireRole('ADMIN', 'COLLABORATOR');
const canApprove = requireRole('ADMIN');

router.get('/', validate(listPaymentOrdersQuerySchema, 'query'), controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createPaymentOrderSchema), controller.create);
router.post('/vendor-bills', canManage, validate(createPaymentOrderForVendorBillsSchema), controller.createForVendorBills);
router.post('/:id/submit', canManage, controller.submit);
router.post('/:id/decide', canApprove, validate(decideApprovalSchema), controller.decide);
router.post('/:id/cancel', canManage, controller.cancel);

module.exports = router;
