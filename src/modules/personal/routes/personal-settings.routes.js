const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { updatePersonalSettingsSchema } = require('../validators/personal-settings.validator');
const controller = require('../controllers/personal-settings.controller');

const router = Router();

router.get('/', controller.getSettings);
// Configurar a qué cuenta contable va la nómina/los reembolsos es una
// decisión más sensible que el día a día del módulo — se restringe a
// ADMIN, mismo criterio que el resto del proyecto usa para la
// configuración contable de cada módulo (ej. /accounting/settings).
router.patch('/', requireRole('ADMIN'), validate(updatePersonalSettingsSchema), controller.updateSettings);

module.exports = router;
