const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { uploadDocumentSchema, searchDocumentsQuerySchema } = require('../validators/fiscal-documents.validator');
const controller = require('../controllers/fiscal-documents.controller');

const router = Router();

const canManage = requireRole('ADMIN');

router.get('/', validate(searchDocumentsQuerySchema, 'query'), controller.search);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(uploadDocumentSchema), controller.upload);
router.delete('/:id', canManage, controller.remove);

module.exports = router;
