const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createVendorSchema, updateVendorSchema, listVendorsQuerySchema } = require('../validators/vendors.validator');
const controller = require('../controllers/vendors.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.get('/', validate(listVendorsQuerySchema, 'query'), controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createVendorSchema), controller.create);
router.patch('/:id', canManage, validate(updateVendorSchema), controller.update);

module.exports = router;
