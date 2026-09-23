const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { quickSaleSchema } = require('../validators/quick-sale.validator');
const controller = require('../controllers/quick-sale.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.post('/', canManage, validate(quickSaleSchema), controller.create);

module.exports = router;
