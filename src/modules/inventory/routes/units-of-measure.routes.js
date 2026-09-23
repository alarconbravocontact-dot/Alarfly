const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createUnitOfMeasureSchema } = require('../validators/units-of-measure.validator');
const controller = require('../controllers/units-of-measure.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createUnitOfMeasureSchema), controller.create);

module.exports = router;
