const { Router } = require('express');
const { requireAuth } = require('../../../core/auth/auth.middleware');
const { requireModuleAccess } = require('../../../core/rbac/rbac.middleware');
const salesOrdersRoutes = require('./sales-orders.routes');
const salesDeliveriesRoutes = require('./sales-deliveries.routes');
const quickSaleRoutes = require('./quick-sale.routes');

const router = Router();

router.use(requireAuth);
router.use(requireModuleAccess('sales'));
router.use('/orders', salesOrdersRoutes);
router.use('/deliveries', salesDeliveriesRoutes);
router.use('/quick-sale', quickSaleRoutes);

module.exports = router;
