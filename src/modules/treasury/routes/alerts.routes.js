const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createAlertRuleSchema, listAlertsQuerySchema } = require('../validators/alerts.validator');
const controller = require('../controllers/alerts.controller');

const router = Router();

const canManage = requireRole('ADMIN');

router.get('/rules', controller.listRules);
router.post('/rules', canManage, validate(createAlertRuleSchema), controller.createRule);
router.post('/rules/:id/deactivate', canManage, controller.deactivateRule);

router.post('/scan', canManage, controller.scan);
router.get('/', validate(listAlertsQuerySchema, 'query'), controller.list);
router.post('/:id/acknowledge', controller.acknowledge);

module.exports = router;
