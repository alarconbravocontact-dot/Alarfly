const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { importStatementSchema, listBankTransactionsQuerySchema } = require('../validators/statement-import.validator');
const controller = require('../controllers/statement-import.controller');

const router = Router();

const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.post('/import', canManage, validate(importStatementSchema), controller.importStatement);
router.get('/imports', controller.listImports);
router.get('/transactions', validate(listBankTransactionsQuerySchema, 'query'), controller.listTransactions);

module.exports = router;
