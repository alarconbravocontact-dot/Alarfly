const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createCreditNoteSchema, listCreditNotesQuerySchema } = require('../validators/ap-credit-notes.validator');
const controller = require('../controllers/ap-credit-notes.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.get('/', validate(listCreditNotesQuerySchema, 'query'), controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createCreditNoteSchema), controller.create);

module.exports = router;
