const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createKpiDefinitionSchema, dateRangeQuerySchema, compareKpiQuerySchema } = require('../validators/kpis.validator');
const controller = require('../controllers/kpis.controller');

const router = Router();

const canManage = requireRole('ADMIN', 'FINANCE');

router.get('/ebitda', validate(dateRangeQuerySchema, 'query'), controller.getEbitda);
router.get('/burn-rate-runway', validate(dateRangeQuerySchema, 'query'), controller.getBurnRateAndRunway);

router.get('/definitions', controller.list);
router.post('/definitions', canManage, validate(createKpiDefinitionSchema), controller.create);
router.get('/definitions/:id/evaluate', validate(dateRangeQuerySchema, 'query'), controller.evaluate);
router.get('/definitions/:id/compare', validate(compareKpiQuerySchema, 'query'), controller.compare);

module.exports = router;
