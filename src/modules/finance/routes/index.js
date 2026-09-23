const { Router } = require('express');
const { requireAuth } = require('../../../core/auth/auth.middleware');
const { requireModuleAccess } = require('../../../core/rbac/rbac.middleware');
const controller = require('../controllers/finance-summary.controller');

const router = Router();

router.use(requireAuth);
router.use(requireModuleAccess('finance'));
router.get('/summary', controller.getSummary);

module.exports = router;
