const { Router } = require('express');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../auth/auth.middleware');
const { pinItemSchema, recordVisitSchema } = require('./pinned-items.validator');
const controller = require('./pinned-items.controller');

const router = Router();

// Sin gate de módulo, mismo criterio que core/saved-views y
// core/table-preferences: anclar una ruta es una preferencia de
// navegación personal, no algo que exponga datos por sí solo — la
// pantalla real detrás de esa ruta ya tiene su propio control de
// acceso.
router.use(requireAuth);

router.get('/', controller.listPinnedItems);
router.post('/', validate(pinItemSchema), controller.pinItem);
router.delete('/:id', controller.unpinItem);
router.post('/visit', validate(recordVisitSchema), controller.recordVisit);

module.exports = router;
