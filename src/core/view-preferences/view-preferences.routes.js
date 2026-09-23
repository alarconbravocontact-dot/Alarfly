const { Router } = require('express');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../auth/auth.middleware');
const { setPreferenceSchema } = require('./view-preferences.validator');
const controller = require('./view-preferences.controller');

const router = Router();

// Sin gate de módulo a propósito, mismo criterio que
// core/panel-preferences/core/table-preferences: no expone ningún dato
// financiero por sí solo — solo recuerda qué vista (Lista/Kanban/
// Calendario) eligió el usuario en una pantalla a la que ya tiene acceso.
router.use(requireAuth);

router.get('/:viewKey', controller.getPreference);
router.patch('/:viewKey', validate(setPreferenceSchema), controller.setPreference);

module.exports = router;
