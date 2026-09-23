const { Router } = require('express');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../auth/auth.middleware');
const { savePreferencesSchema, exportTableSchema } = require('./table-preferences.validator');
const controller = require('./table-preferences.controller');

const router = Router();

// Sin gate de módulo a propósito, mismo criterio que core/saved-views:
// esto no expone datos financieros por sí solo (la tabla real la
// protege su propia pantalla) — cualquier usuario autenticado puede
// leer/guardar CÓMO ve una tabla a la que ya tiene acceso.
router.use(requireAuth);

router.post('/export', validate(exportTableSchema), controller.exportTable);
router.get('/:tableKey', controller.getPreferences);
router.patch('/:tableKey', validate(savePreferencesSchema), controller.savePreferences);
router.delete('/:tableKey', controller.resetPreferences);

module.exports = router;
