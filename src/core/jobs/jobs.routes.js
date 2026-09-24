const { Router } = require('express');
const { requireAuth, requireRole } = require('../auth/auth.middleware');
const controller = require('./jobs.controller');

const router = Router();

// Ruta neutral (mismo criterio que /notifications, /audit-log): los
// jobs automáticos cruzan varios módulos (Contabilidad, Tesorería,
// Fiscal, Inventario, AR, Análisis Avanzados), así que no llevan
// `requireModuleAccess` de un módulo en particular — pero SÍ son
// observabilidad administrativa (cuándo corrió cada proceso automático
// y con qué resultado), así que quedan restringidos a ADMIN, igual que
// el resto de la auditoría de la empresa.
router.use(requireAuth, requireRole('ADMIN'));

router.get('/status', controller.status);
router.get('/runs', controller.runs);

module.exports = router;
