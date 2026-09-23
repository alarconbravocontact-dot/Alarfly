const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createSalesOrderSchema, cancelSalesOrderSchema, listSalesOrdersQuerySchema } = require('../validators/sales-orders.validator');
const controller = require('../controllers/sales-orders.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.get('/', validate(listSalesOrdersQuerySchema, 'query'), controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createSalesOrderSchema), controller.create);
router.post('/:id/confirm', canManage, controller.confirm);
router.post('/:id/cancel', canManage, validate(cancelSalesOrderSchema), controller.cancel);

module.exports = router;
