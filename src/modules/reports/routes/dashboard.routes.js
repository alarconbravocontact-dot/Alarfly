// Fase 9: el Dashboard es el Inicio de TODA la aplicación, no una
// pantalla más de Reportes — así que sus rutas dejaron de vivir bajo
// el gate `requireModuleAccess('reports')` (ADMIN/FINANCE únicamente,
// ver `core/rbac/module-access.js`), que habría dejado a Contador y
// Colaborador sin poder ver siquiera un Inicio vacío. Cada usuario
// autenticado puede pedir el Dashboard; es `dashboard.service.js`
// quien filtra CADA widget por rol antes de calcularlo (sección 12/40
// del prompt oficial: "la API también debe proteger los datos", no
// solo ocultar un botón). Mismo criterio ya usado por `/notifications`,
// `/glossary` y `/fx/latest-rates`: una ruta neutral, con su propio
// `requireAuth`, sin gate de módulo.
const { Router } = require('express');
const { requireAuth } = require('../../../core/auth/auth.middleware');
const validate = require('../../../core/middlewares/validate');
const { dashboardQuerySchema, setWidgetPreferenceSchema } = require('../validators/dashboard.validator');
const controller = require('../controllers/dashboard.controller');

const router = Router();

router.use(requireAuth);

router.get('/dashboard', validate(dashboardQuerySchema, 'query'), controller.getDashboard);
router.get('/dashboard/widgets', controller.listWidgets);
router.get('/dashboard/preferences', controller.getPreferences);
router.patch('/dashboard/preferences/:widgetKey', validate(setWidgetPreferenceSchema), controller.setPreference);
router.delete('/dashboard/preferences', controller.resetPreferences);

module.exports = router;
