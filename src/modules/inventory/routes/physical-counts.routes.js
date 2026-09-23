const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { startCountSchema, submitCountSchema, rejectCountSchema } = require('../validators/physical-counts.validator');
const controller = require('../controllers/physical-counts.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');
const canApprove = requireRole('ADMIN', 'COLLABORATOR');

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(startCountSchema), controller.start);
router.post('/:id/submit', canManage, validate(submitCountSchema), controller.submit);
router.post('/:id/approve', canApprove, controller.approve);
router.post('/:id/reject', canApprove, validate(rejectCountSchema), controller.reject);

module.exports = router;
