const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { recordRateSchema, revalueSchema } = require('../validators/fx.validator');
const controller = require('../controllers/fx.controller');

const router = Router();

const canManage = requireRole('ADMIN', 'ACCOUNTANT');

router.get('/rates', controller.listRates);
router.post('/rates', canManage, validate(recordRateSchema), controller.recordRate);
router.post('/revalue', canManage, validate(revalueSchema), controller.revalue);

module.exports = router;
