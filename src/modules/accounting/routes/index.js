const { Router } = require('express');
const { requireAuth } = require('../../../core/auth/auth.middleware');
const { requireModuleAccess } = require('../../../core/rbac/rbac.middleware');
const accountsRoutes = require('./accounts.routes');
const accountTemplatesRoutes = require('./account-templates.routes');
const dimensionsRoutes = require('./dimensions.routes');
const journalEntriesRoutes = require('./journal-entries.routes');
const reportsRoutes = require('./reports.routes');
const periodsRoutes = require('./periods.routes');
const auditRoutes = require('./audit.routes');
const fxRoutes = require('./fx.routes');
const fixedAssetsRoutes = require('./fixed-assets.routes');
const consolidationRoutes = require('./consolidation.routes');
const settingsRoutes = require('./settings.routes');

const router = Router();

router.use(requireAuth);
router.use(requireModuleAccess('accounting'));
router.use('/accounts', accountsRoutes);
router.use('/account-templates', accountTemplatesRoutes);
router.use('/dimensions', dimensionsRoutes);
router.use('/journal-entries', journalEntriesRoutes);
router.use('/reports', reportsRoutes);
router.use('/periods', periodsRoutes);
router.use('/audit-log', auditRoutes);
router.use('/fx', fxRoutes);
router.use('/fixed-assets', fixedAssetsRoutes);
router.use('/consolidation', consolidationRoutes);
router.use('/settings', settingsRoutes);

module.exports = router;
