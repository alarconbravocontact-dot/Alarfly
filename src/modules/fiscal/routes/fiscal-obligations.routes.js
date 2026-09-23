const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createObligationSchema, updateObligationSchema, listObligationsQuerySchema } = require('../validators/fiscal-obligations.validator');
const controller = require('../controllers/fiscal-obligations.controller');

const router = Router();

const canManage = requireRole('ADMIN');

router.get('/', validate(listObligationsQuerySchema, 'query'), controller.list);
router.post('/', canManage, validate(createObligationSchema), controller.create);
router.patch('/:id', canManage, validate(updateObligationSchema), controller.update);
router.post('/scan', canManage, controller.scan);

module.exports = router;
