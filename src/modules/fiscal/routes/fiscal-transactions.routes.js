const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createFiscalTransactionSchema, listFiscalTransactionsQuerySchema } = require('../validators/fiscal-transactions.validator');
const controller = require('../controllers/fiscal-transactions.controller');

const router = Router();

const canManage = requireRole('ADMIN');

router.get('/', validate(listFiscalTransactionsQuerySchema, 'query'), controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createFiscalTransactionSchema), controller.create);

module.exports = router;
