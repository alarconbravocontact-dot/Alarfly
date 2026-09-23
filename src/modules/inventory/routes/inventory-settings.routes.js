const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { updateInventorySettingsSchema } = require('../validators/inventory-settings.validator');
const controller = require('../controllers/inventory-settings.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.get('/', controller.getSettings);
router.patch('/', canManage, validate(updateInventorySettingsSchema), controller.updateSettings);

module.exports = router;
