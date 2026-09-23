const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createTemplateSchema } = require('../validators/ar-recurring.validator');
const controller = require('../controllers/ar-recurring.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.get('/', controller.list);
router.post('/', canManage, validate(createTemplateSchema), controller.create);
router.patch('/:id/deactivate', canManage, controller.deactivate);

module.exports = router;
