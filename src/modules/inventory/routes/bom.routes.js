const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createBomSchema } = require('../validators/bom.validator');
const controller = require('../controllers/bom.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.get('/:parentVariantId', controller.getOne);
router.post('/', canManage, validate(createBomSchema), controller.create);
router.post('/:parentVariantId/deactivate', canManage, controller.deactivate);

module.exports = router;
