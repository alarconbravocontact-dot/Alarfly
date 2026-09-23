const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createDimensionSchema } = require('../validators/dimensions.validator');
const controller = require('../controllers/dimensions.controller');

const router = Router();

router.get('/', controller.list);
router.post('/', requireRole('ADMIN', 'ACCOUNTANT'), validate(createDimensionSchema), controller.create);
router.delete('/:id', requireRole('ADMIN', 'ACCOUNTANT'), controller.remove);

module.exports = router;
