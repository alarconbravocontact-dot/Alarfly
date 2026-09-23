const { Router } = require('express');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../auth/auth.middleware');
const { createSavedViewSchema, listSavedViewsQuerySchema } = require('./saved-views.validator');
const controller = require('./saved-views.controller');

const router = Router();

// Sin gate de módulo a propósito: guardar/ver un filtro no expone
// datos financieros por sí solo (la tabla real la protege su propia
// pantalla) — cualquier usuario autenticado de la empresa puede leer
// y crear vistas para las tablas a las que ya tiene acceso.
router.use(requireAuth);

router.get('/', validate(listSavedViewsQuerySchema, 'query'), controller.listSavedViews);
router.post('/', validate(createSavedViewSchema), controller.createSavedView);
router.get('/:id', controller.getSavedView);
router.delete('/:id', controller.deleteSavedView);

module.exports = router;
