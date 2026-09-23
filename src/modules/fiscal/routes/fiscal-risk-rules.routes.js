const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createRuleSchema, updateRuleSchema, listRulesQuerySchema } = require('../validators/fiscal-risk-rules.validator');
const controller = require('../controllers/fiscal-risk-rules.controller');

const router = Router();

const canManage = requireRole('ADMIN');

router.get('/', validate(listRulesQuerySchema, 'query'), controller.list);
router.post('/', canManage, validate(createRuleSchema), controller.create);
router.patch('/:id', canManage, validate(updateRuleSchema), controller.update);

module.exports = router;
