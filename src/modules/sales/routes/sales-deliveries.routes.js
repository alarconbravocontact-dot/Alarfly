const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createSalesDeliverySchema, cancelSalesDeliverySchema, listSalesDeliveriesQuerySchema } = require('../validators/sales-deliveries.validator');
const controller = require('../controllers/sales-deliveries.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.get('/', validate(listSalesDeliveriesQuerySchema, 'query'), controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createSalesDeliverySchema), controller.create);
router.post('/:id/confirm', canManage, controller.confirm);
router.post('/:id/cancel', canManage, validate(cancelSalesDeliverySchema), controller.cancel);

module.exports = router;
