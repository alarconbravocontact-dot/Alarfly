const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createRuleSchema } = require('../validators/payment-approval-rules.validator');
const controller = require('../controllers/payment-approval-rules.controller');

const router = Router();

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', requireRole('ADMIN'), validate(createRuleSchema), controller.create);
router.post('/:id/deactivate', requireRole('ADMIN'), controller.deactivate);

module.exports = router;
