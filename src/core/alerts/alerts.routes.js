const { Router } = require('express');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../auth/auth.middleware');
const { listNotificationsQuerySchema } = require('./alerts.validator');
const controller = require('./alerts.controller');

const router = Router();

// Ruta neutral (montada en /notifications): las alertas ya abarcan
// varios módulos (Tesorería, Fiscal, Inventario, AR, Análisis
// Avanzados), así que no lleva `requireModuleAccess` — cualquier
// usuario autenticado ve y atiende las suyas, filtradas por su propia
// preferencia "en la aplicación" (Mi Cuenta > Notificaciones).
router.use(requireAuth);

router.get('/', validate(listNotificationsQuerySchema, 'query'), controller.list);
router.post('/:id/acknowledge', controller.acknowledge);

module.exports = router;
