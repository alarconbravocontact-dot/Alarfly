const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const {
  createProductSchema,
  updateProductSchema,
  addVariantSchema,
  listProductsQuerySchema,
} = require('../validators/products.validator');
const controller = require('../controllers/products.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.get('/', validate(listProductsQuerySchema, 'query'), controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createProductSchema), controller.create);
router.patch('/:id', canManage, validate(updateProductSchema), controller.update);
router.post('/:id/variants', canManage, validate(addVariantSchema), controller.addVariant);

module.exports = router;
