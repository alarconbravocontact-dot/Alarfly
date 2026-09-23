const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { consolidationQuerySchema } = require('../validators/consolidation.validator');
const controller = require('../controllers/consolidation.controller');

const router = Router();

router.get('/consolidation/trial-balance', requireRole('ADMIN'), validate(consolidationQuerySchema, 'query'), controller.trialBalance);

module.exports = router;
