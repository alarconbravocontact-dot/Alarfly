const { Router } = require('express');
const { requireAuth } = require('../auth/auth.middleware');
const controller = require('./fx.controller');

// Ruta neutral (sin requireModuleAccess): el selector de divisa de
// visualización es una preferencia transversal, la usa cualquier
// usuario autenticado sin importar a qué módulos tiene acceso — mismo
// criterio que /notifications y /glossary. El registro/edición de
// tasas sigue viviendo bajo /accounting/fx/*, gateado a Contabilidad,
// porque esa sí es una acción de negocio (afecta revaluación real).
const router = Router();

router.use(requireAuth);
router.get('/latest-rates', controller.listLatestRates);

module.exports = router;
