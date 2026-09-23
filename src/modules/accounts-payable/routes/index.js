const { Router } = require('express');
const { requireAuth } = require('../../../core/auth/auth.middleware');
const { requireModuleAccess } = require('../../../core/rbac/rbac.middleware');
const vendorsRoutes = require('./vendors.routes');
const apBillsRoutes = require('./ap-bills.routes');
const apPaymentsRoutes = require('./ap-payments.routes');

const router = Router();

router.use(requireAuth);
router.use(requireModuleAccess('accounts-payable'));
router.use('/vendors', vendorsRoutes);
router.use('/bills', apBillsRoutes);
router.use('/payments', apPaymentsRoutes);

module.exports = router;
