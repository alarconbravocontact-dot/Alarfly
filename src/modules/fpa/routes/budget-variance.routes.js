const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { updateFpaSettingsSchema, submitJustificationSchema } = require('../validators/budget-variance.validator');
const controller = require('../controllers/budget-variance.controller');

const router = Router();

const canManage = requireRole('ADMIN', 'FINANCE');

router.get('/settings', controller.getSettings);
router.patch('/settings', canManage, validate(updateFpaSettingsSchema), controller.updateSettings);

router.get('/budgets/:budgetId/report', controller.getReport);
router.post('/lines/:lineId/justify', canManage, validate(submitJustificationSchema), controller.justify);
router.get('/lines/:lineId/justifications', controller.listJustifications);

module.exports = router;
