const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { asOfDateQuerySchema } = require('../validators/reports.validator');
const { setParentCompanySchema } = require('../validators/consolidation.validator');
const controller = require('../controllers/consolidation.controller');

const router = Router();

router.use(requireRole('ADMIN'));
router.get('/trial-balance', validate(asOfDateQuerySchema, 'query'), controller.trialBalance);
router.patch('/parent-company', validate(setParentCompanySchema), controller.setParentCompany);

module.exports = router;
