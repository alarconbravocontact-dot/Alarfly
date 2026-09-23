const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const {
  createFpaDimensionSchema,
  updateFpaDimensionSchema,
  listFpaDimensionsQuerySchema,
  tagJournalEntryLineSchema,
} = require('../validators/fpa-dimensions.validator');
const controller = require('../controllers/fpa-dimensions.controller');

const router = Router();

const canManage = requireRole('ADMIN', 'FINANCE');

router.get('/', validate(listFpaDimensionsQuerySchema, 'query'), controller.list);
router.get('/tree', controller.tree);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createFpaDimensionSchema), controller.create);
router.patch('/:id', canManage, validate(updateFpaDimensionSchema), controller.update);
router.delete('/:id', canManage, controller.remove);

router.post('/tags', canManage, validate(tagJournalEntryLineSchema), controller.tagLine);
router.delete('/tags/:tagId', canManage, controller.untagLine);

module.exports = router;
