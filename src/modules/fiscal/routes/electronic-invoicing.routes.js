const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { generateDocumentSchema, cancelDocumentSchema, listDocumentsQuerySchema } = require('../validators/electronic-invoicing.validator');
const controller = require('../controllers/electronic-invoicing.controller');

const router = Router();

const canManage = requireRole('ADMIN');

router.get('/', validate(listDocumentsQuerySchema, 'query'), controller.list);
router.get('/:id', controller.getOne);
router.post('/transactions/:transactionId/generate', canManage, validate(generateDocumentSchema), controller.generate);
router.post('/:id/cancel', canManage, validate(cancelDocumentSchema), controller.cancel);

module.exports = router;
