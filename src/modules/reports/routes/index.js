const { Router } = require('express');
const { requireAuth } = require('../../../core/auth/auth.middleware');
const { requireModuleAccess } = require('../../../core/rbac/rbac.middleware');
const financialStatementsRoutes = require('./financial-statements.routes');
const cashFlowRoutes = require('./cash-flow.routes');
const profitabilityRoutes = require('./profitability.routes');
const consolidationRoutes = require('./consolidation.routes');
const dashboardRoutes = require('./dashboard.routes');
const exportRoutes = require('./export.routes');
const agingRoutes = require('./aging.routes');

const router = Router();

router.use(requireAuth);
router.use(requireModuleAccess('reports'));
router.use('/', financialStatementsRoutes);
router.use('/', cashFlowRoutes);
router.use('/', profitabilityRoutes);
router.use('/', consolidationRoutes);
router.use('/', dashboardRoutes);
router.use('/', exportRoutes);
router.use('/', agingRoutes);

module.exports = router;
