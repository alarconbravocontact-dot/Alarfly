const { Router } = require('express');
const { requireAuth } = require('../../../core/auth/auth.middleware');
const { requireModuleAccess } = require('../../../core/rbac/rbac.middleware');
const taxRatesRoutes = require('./tax-rates.routes');
const fiscalTransactionsRoutes = require('./fiscal-transactions.routes');
const fiscalRiskRulesRoutes = require('./fiscal-risk-rules.routes');
const fiscalBooksRoutes = require('./fiscal-books.routes');
const electronicInvoicingRoutes = require('./electronic-invoicing.routes');
const fiscalObligationsRoutes = require('./fiscal-obligations.routes');
const fiscalDocumentsRoutes = require('./fiscal-documents.routes');

const router = Router();

router.use(requireAuth);
router.use(requireModuleAccess('fiscal'));
router.use('/tax', taxRatesRoutes);
router.use('/transactions', fiscalTransactionsRoutes);
router.use('/risk-rules', fiscalRiskRulesRoutes);
router.use('/books', fiscalBooksRoutes);
router.use('/electronic-documents', electronicInvoicingRoutes);
router.use('/obligations', fiscalObligationsRoutes);
router.use('/documents', fiscalDocumentsRoutes);

module.exports = router;
