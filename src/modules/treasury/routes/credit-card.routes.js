const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const {
  importCardStatementSchema,
  listCardTransactionsQuerySchema,
  flagTransactionSchema,
  matchPettyCashSchema,
} = require('../validators/credit-card.validator');
const controller = require('../controllers/credit-card.controller');

const router = Router();

const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.post('/import', canManage, validate(importCardStatementSchema), controller.importStatement);
router.get('/transactions', validate(listCardTransactionsQuerySchema, 'query'), controller.list);
router.patch('/transactions/:id/flag', canManage, validate(flagTransactionSchema), controller.flag);
router.patch('/transactions/:id/match-petty-cash', canManage, validate(matchPettyCashSchema), controller.matchPettyCash);

module.exports = router;
