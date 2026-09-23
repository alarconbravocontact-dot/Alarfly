const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createFixedAssetSchema, runDepreciationSchema, disposeSchema } = require('../validators/fixed-assets.validator');
const controller = require('../controllers/fixed-assets.controller');

const router = Router();

const canManage = requireRole('ADMIN', 'ACCOUNTANT');

router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createFixedAssetSchema), controller.create);
router.post('/:id/dispose', canManage, validate(disposeSchema), controller.dispose);
router.post('/run-depreciation', canManage, validate(runDepreciationSchema), controller.runDepreciation);

module.exports = router;
