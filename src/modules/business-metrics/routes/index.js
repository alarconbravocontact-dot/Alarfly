const { Router } = require('express');
const { requireAuth, requireRole } = require('../../../core/auth/auth.middleware');
const { requireModuleAccess } = require('../../../core/rbac/rbac.middleware');
const validate = require('../../../core/middlewares/validate');
const {
  createMetricSchema,
  updateMetricSchema,
  listMetricsQuerySchema,
  addEntrySchema,
  dateRangeQuerySchema,
} = require('../validators/business-metrics.validator');
const controller = require('../controllers/business-metrics.controller');

const router = Router();

const canManage = requireRole('ADMIN', 'FINANCE');

router.use(requireAuth);
router.use(requireModuleAccess('business-metrics'));

router.get('/', validate(listMetricsQuerySchema, 'query'), controller.list);
router.post('/', canManage, validate(createMetricSchema), controller.create);
router.patch('/:id', canManage, validate(updateMetricSchema), controller.update);

router.get('/:id/entries', validate(dateRangeQuerySchema, 'query'), controller.listEntries);
router.post('/:id/entries', canManage, validate(addEntrySchema), controller.addEntry);
router.delete('/:id/entries/:entryId', canManage, controller.deleteEntry);

router.get('/:id/stats', validate(dateRangeQuerySchema, 'query'), controller.getStats);

module.exports = router;
