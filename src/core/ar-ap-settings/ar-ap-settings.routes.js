const { Router } = require('express');
const validate = require('../middlewares/validate');
const { requireAuth, requireRole } = require('../auth/auth.middleware');
const { updateArApSettingsSchema } = require('./ar-ap-settings.validator');
const controller = require('./ar-ap-settings.controller');

const router = Router();

router.use(requireAuth);
router.get('/', controller.getSettings);
router.patch('/', requireRole('ADMIN'), validate(updateArApSettingsSchema), controller.updateSettings);

module.exports = router;
