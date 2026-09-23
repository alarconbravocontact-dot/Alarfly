const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const {
  createPurchaseOrderSchema,
  receivePurchaseOrderSchema,
  listPurchaseOrdersQuerySchema,
} = require('../validators/purchase-orders.validator');
const controller = require('../controllers/purchase-orders.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.get('/', validate(listPurchaseOrdersQuerySchema, 'query'), controller.list);
router.post('/scan', canManage, controller.scan);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createPurchaseOrderSchema), controller.create);
router.post('/:id/submit', canManage, controller.submit);
router.post('/:id/receive', canManage, validate(receivePurchaseOrderSchema), controller.receive);
router.post('/:id/cancel', canManage, controller.cancel);

module.exports = router;
