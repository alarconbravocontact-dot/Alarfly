const { Router } = require('express');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../auth/auth.middleware');
const { setPreferenceSchema } = require('./panel-preferences.validator');
const controller = require('./panel-preferences.controller');

const router = Router();

// Sin gate de módulo a propósito, mismo criterio que core/table-preferences:
// esto no expone ningún dato financiero por sí solo — cualquier usuario
// autenticado puede leer/guardar si un panel al que ya tiene acceso está
// contraído o expandido para él.
router.use(requireAuth);

router.get('/:panelKey', controller.getPreference);
router.patch('/:panelKey', validate(setPreferenceSchema), controller.setPreference);

module.exports = router;
