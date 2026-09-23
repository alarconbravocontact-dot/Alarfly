const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const {
  createTreasuryAccountSchema,
  updateTreasuryAccountSchema,
  listTreasuryAccountsQuerySchema,
  cashPositionQuerySchema,
} = require('../validators/treasury-accounts.validator');
const controller = require('../controllers/treasury-accounts.controller');

const router = Router();

const canManage = requireRole('ADMIN');

router.get('/cash-position', validate(cashPositionQuerySchema, 'query'), controller.cashPosition);
router.get('/', validate(listTreasuryAccountsQuerySchema, 'query'), controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createTreasuryAccountSchema), controller.create);
router.patch('/:id', canManage, validate(updateTreasuryAccountSchema), controller.update);

module.exports = router;
