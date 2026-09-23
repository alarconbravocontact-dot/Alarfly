const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { recordPaymentSchema, applyAdvanceSchema, listPaymentsQuerySchema } = require('../validators/ar-payments.validator');
const controller = require('../controllers/ar-payments.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.get('/', validate(listPaymentsQuerySchema, 'query'), controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(recordPaymentSchema), controller.create);
router.post('/:id/apply-advance', canManage, validate(applyAdvanceSchema), controller.applyAdvance);

module.exports = router;
