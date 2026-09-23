const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const {
  createAccountSchema,
  updateAccountSchema,
  listAccountsQuerySchema,
} = require('../validators/accounts.validator');
const controller = require('../controllers/accounts.controller');

const router = Router();

const canManage = requireRole('ADMIN', 'ACCOUNTANT');

router.get('/', validate(listAccountsQuerySchema, 'query'), controller.list);
router.get('/tree', controller.tree);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createAccountSchema), controller.create);
router.patch('/:id', canManage, validate(updateAccountSchema), controller.update);
router.delete('/:id', canManage, controller.remove);

module.exports = router;
