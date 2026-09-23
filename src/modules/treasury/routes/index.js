const { Router } = require('express');
const { requireAuth } = require('../../../core/auth/auth.middleware');
const { requireModuleAccess } = require('../../../core/rbac/rbac.middleware');
const treasuryAccountsRoutes = require('./treasury-accounts.routes');
const statementImportRoutes = require('./statement-import.routes');
const reconciliationRoutes = require('./reconciliation.routes');
const creditCardRoutes = require('./credit-card.routes');
const paymentApprovalRulesRoutes = require('./payment-approval-rules.routes');
const paymentOrdersRoutes = require('./payment-orders.routes');
const paymentBatchesRoutes = require('./payment-batches.routes');
const debtsRoutes = require('./debts.routes');
const pettyCashRoutes = require('./petty-cash.routes');
const alertsRoutes = require('./alerts.routes');
const liquidityForecastRoutes = require('./liquidity-forecast.routes');
const paymentCalendarRoutes = require('./payment-calendar.routes');

const router = Router();

router.use(requireAuth);
router.use(requireModuleAccess('treasury'));
router.use('/accounts', treasuryAccountsRoutes);
router.use('/bank-feeds', statementImportRoutes);
router.use('/reconciliations', reconciliationRoutes);
router.use('/credit-cards', creditCardRoutes);
router.use('/payment-approval-rules', paymentApprovalRulesRoutes);
router.use('/payment-orders', paymentOrdersRoutes);
router.use('/payment-batches', paymentBatchesRoutes);
router.use('/debts', debtsRoutes);
router.use('/petty-cash', pettyCashRoutes);
router.use('/alerts', alertsRoutes);
router.use('/liquidity-forecast', liquidityForecastRoutes);
router.use('/payment-calendar', paymentCalendarRoutes);

module.exports = router;
