const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const {
  createCustomerSchema,
  updateCustomerSchema,
  blockCustomerSchema,
  listCustomersQuerySchema,
  importCustomersSchema,
} = require('../validators/customers.validator');
const controller = require('../controllers/customers.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.get('/', validate(listCustomersQuerySchema, 'query'), controller.list);
router.post('/import', canManage, validate(importCustomersSchema), controller.importCustomers);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createCustomerSchema), controller.create);
router.patch('/:id', canManage, validate(updateCustomerSchema), controller.update);
router.post('/:id/block', canManage, validate(blockCustomerSchema), controller.block);
router.post('/:id/unblock', canManage, controller.unblock);

module.exports = router;
