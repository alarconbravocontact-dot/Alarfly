const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const {
  createEntrySchema,
  reverseEntrySchema,
  listEntriesQuerySchema,
} = require('../validators/journal-entries.validator');
const controller = require('../controllers/journal-entries.controller');

const router = Router();

const canRecord = requireRole('ADMIN', 'ACCOUNTANT');
const canApprove = requireRole('ADMIN', 'ACCOUNTANT');

router.get('/', validate(listEntriesQuerySchema, 'query'), controller.list);
router.get('/:id', controller.getOne);
router.post('/', canRecord, validate(createEntrySchema), controller.create);
router.post('/:id/submit', canRecord, controller.submit);
router.post('/:id/approve', canApprove, controller.approve);
router.post('/:id/reverse', canRecord, validate(reverseEntrySchema), controller.reverse);
router.delete('/:id', canRecord, controller.remove);

module.exports = router;
