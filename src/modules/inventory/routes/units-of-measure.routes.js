const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createUnitOfMeasureSchema, updateUnitOfMeasureSchema, listUnitsOfMeasureQuerySchema } = require('../validators/units-of-measure.validator');
const controller = require('../controllers/units-of-measure.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.get('/', validate(listUnitsOfMeasureQuerySchema, 'query'), controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createUnitOfMeasureSchema), controller.create);
router.patch('/:id', canManage, validate(updateUnitOfMeasureSchema), controller.update);

module.exports = router;
