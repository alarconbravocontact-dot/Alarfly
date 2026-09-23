const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createCategorySchema } = require('../validators/product-categories.validator');
const controller = require('../controllers/product-categories.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createCategorySchema), controller.create);

module.exports = router;
