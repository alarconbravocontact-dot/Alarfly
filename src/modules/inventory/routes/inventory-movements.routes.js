const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const {
  createEntrySchema,
  createExitSchema,
  createAdjustmentSchema,
  listMovementsQuerySchema,
} = require('../validators/inventory-movements.validator');
const controller = require('../controllers/inventory-movements.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.get('/', validate(listMovementsQuerySchema, 'query'), controller.list);
router.post('/entries', canManage, validate(createEntrySchema), controller.createEntry);
router.post('/exits', canManage, validate(createExitSchema), controller.createExit);
router.post('/adjustments', canManage, validate(createAdjustmentSchema), controller.createAdjustment);

module.exports = router;
