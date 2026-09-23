const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { dashboardQuerySchema, setWidgetPreferenceSchema } = require('../validators/dashboard.validator');
const controller = require('../controllers/dashboard.controller');

const router = Router();

router.get('/dashboard', validate(dashboardQuerySchema, 'query'), controller.getDashboard);
router.get('/dashboard/widgets', controller.listWidgets);
router.get('/dashboard/preferences', controller.getPreferences);
router.patch('/dashboard/preferences/:widgetKey', validate(setWidgetPreferenceSchema), controller.setPreference);

module.exports = router;
