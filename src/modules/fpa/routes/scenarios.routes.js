const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { simulateScenarioSchema, saveScenarioSchema } = require('../validators/scenarios.validator');
const controller = require('../controllers/scenarios.controller');

const router = Router();

const canManage = requireRole('ADMIN', 'FINANCE');

router.post('/simulate', validate(simulateScenarioSchema), controller.simulate);
router.post('/', canManage, validate(saveScenarioSchema), controller.save);
router.get('/', controller.list);
router.get('/:id', controller.getOne);

module.exports = router;
