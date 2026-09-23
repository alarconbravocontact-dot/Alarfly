const { Router } = require('express');
const { requireAuth } = require('../../../core/auth/auth.middleware');
const { requireModuleAccess } = require('../../../core/rbac/rbac.middleware');
const fpaDimensionsRoutes = require('./fpa-dimensions.routes');
const budgetsRoutes = require('./budgets.routes');
const budgetVarianceRoutes = require('./budget-variance.routes');
const scenariosRoutes = require('./scenarios.routes');
const kpisRoutes = require('./kpis.routes');

const router = Router();

router.use(requireAuth);
router.use(requireModuleAccess('fpa'));
router.use('/dimensions', fpaDimensionsRoutes);
router.use('/budgets', budgetsRoutes);
router.use('/variance', budgetVarianceRoutes);
router.use('/scenarios', scenariosRoutes);
router.use('/kpis', kpisRoutes);

module.exports = router;
