const { Router } = require('express');
const { requireAuth } = require('../../../core/auth/auth.middleware');
const { requireModuleAccess } = require('../../../core/rbac/rbac.middleware');
const financialStatementsRoutes = require('./financial-statements.routes');
const cashFlowRoutes = require('./cash-flow.routes');
const profitabilityRoutes = require('./profitability.routes');
const consolidationRoutes = require('./consolidation.routes');
const exportRoutes = require('./export.routes');
const agingRoutes = require('./aging.routes');

// dashboard.routes.js NO se monta acá a propósito desde Fase 9: tiene
// su propio `requireAuth` y se monta directo en app.js, sin el gate
// `requireModuleAccess('reports')` de este router — ver el comentario
// de cabecera de dashboard.routes.js.
const router = Router();

router.use(requireAuth);
router.use(requireModuleAccess('reports'));
router.use('/', financialStatementsRoutes);
router.use('/', cashFlowRoutes);
router.use('/', profitabilityRoutes);
router.use('/', consolidationRoutes);
router.use('/', exportRoutes);
router.use('/', agingRoutes);

module.exports = router;
