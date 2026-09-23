const { Router } = require('express');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../auth/auth.middleware');
const { recordUsageSchema } = require('./recently-used.validator');
const controller = require('./recently-used.controller');

const router = Router();

// Sin gate de módulo a propósito, mismo criterio que core/saved-views y
// core/table-preferences: no expone datos financieros por sí solo (solo
// IDs y una fecha), y cualquier usuario autenticado puede tener su
// propio historial de uso en un campo al que ya tiene acceso.
router.use(requireAuth);

router.post('/:entityType', validate(recordUsageSchema), controller.recordUsage);
router.get('/:entityType', controller.listRecent);

module.exports = router;
