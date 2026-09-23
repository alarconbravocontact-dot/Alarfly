const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createTransferSchema } = require('../validators/transfers.validator');
const controller = require('../controllers/transfers.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createTransferSchema), controller.create);

module.exports = router;
