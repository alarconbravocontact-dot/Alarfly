const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createBatchSchema, addOrderSchema } = require('../validators/payment-batches.validator');
const controller = require('../controllers/payment-batches.controller');

const router = Router();

const canManage = requireRole('ADMIN');

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createBatchSchema), controller.create);
router.post('/:id/orders', canManage, validate(addOrderSchema), controller.addOrder);
router.delete('/:id/orders/:orderId', canManage, controller.removeOrder);
router.post('/:id/export', canManage, controller.exportBatch);

module.exports = router;
