const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createWarehouseSchema, updateWarehouseSchema, listWarehousesQuerySchema } = require('../validators/warehouses.validator');
const controller = require('../controllers/warehouses.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.get('/', validate(listWarehousesQuerySchema, 'query'), controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createWarehouseSchema), controller.create);
router.patch('/:id', canManage, validate(updateWarehouseSchema), controller.update);

module.exports = router;
