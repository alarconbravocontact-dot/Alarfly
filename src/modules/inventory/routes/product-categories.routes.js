const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createCategorySchema, updateCategorySchema, listCategoriesQuerySchema } = require('../validators/product-categories.validator');
const controller = require('../controllers/product-categories.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.get('/', validate(listCategoriesQuerySchema, 'query'), controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createCategorySchema), controller.create);
router.patch('/:id', canManage, validate(updateCategorySchema), controller.update);

module.exports = router;
