const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createBillSchema, listBillsQuerySchema } = require('../validators/ap-bills.validator');
const controller = require('../controllers/ap-bills.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.get('/', validate(listBillsQuerySchema, 'query'), controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createBillSchema), controller.create);

module.exports = router;
