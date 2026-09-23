const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { recordPaymentSchema, listPaymentsQuerySchema } = require('../validators/ap-payments.validator');
const controller = require('../controllers/ap-payments.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.get('/', validate(listPaymentsQuerySchema, 'query'), controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(recordPaymentSchema), controller.create);

module.exports = router;
