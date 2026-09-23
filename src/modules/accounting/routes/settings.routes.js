const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { updateSettingsSchema } = require('../validators/settings.validator');
const controller = require('../controllers/settings.controller');

const router = Router();

router.get('/', controller.get);
router.patch('/', requireRole('ADMIN'), validate(updateSettingsSchema), controller.update);

module.exports = router;
