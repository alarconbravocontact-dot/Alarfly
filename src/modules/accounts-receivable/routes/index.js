const { Router } = require('express');
const { requireAuth } = require('../../../core/auth/auth.middleware');
const { requireModuleAccess } = require('../../../core/rbac/rbac.middleware');
const customersRoutes = require('./customers.routes');
const arInvoicesRoutes = require('./ar-invoices.routes');
const arPaymentsRoutes = require('./ar-payments.routes');
const arCollectionsRoutes = require('./ar-collections.routes');
const arCreditNotesRoutes = require('./ar-credit-notes.routes');
const executiveSummaryRoutes = require('./executive-summary.routes');
const arRecurringRoutes = require('./ar-recurring.routes');

const router = Router();

router.use(requireAuth);
router.use(requireModuleAccess('accounts-receivable'));
router.use('/customers', customersRoutes);
router.use('/invoices', arInvoicesRoutes);
router.use('/payments', arPaymentsRoutes);
router.use('/collections', arCollectionsRoutes);
router.use('/credit-notes', arCreditNotesRoutes);
router.use('/executive-summary', executiveSummaryRoutes);
router.use('/recurring-templates', arRecurringRoutes);

module.exports = router;
