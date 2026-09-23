const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createBudgetSchema, listBudgetsQuerySchema, upsertBudgetLineSchema } = require('../validators/budgets.validator');
const controller = require('../controllers/budgets.controller');

const router = Router();

const canManage = requireRole('ADMIN', 'FINANCE');
const canApprove = requireRole('ADMIN', 'FINANCE');

router.get('/', validate(listBudgetsQuerySchema, 'query'), controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createBudgetSchema), controller.create);
router.post('/:id/submit-for-review', canManage, controller.submitForReview);
router.post('/:id/send-back-to-draft', canManage, controller.sendBackToDraft);
router.post('/:id/approve', canApprove, controller.approve);
router.post('/:id/lines', canManage, validate(upsertBudgetLineSchema), controller.upsertLine);
router.delete('/:id/lines/:lineId', canManage, controller.deleteLine);

module.exports = router;
