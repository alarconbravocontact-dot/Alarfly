const { Router } = require('express');
const { requireAuth } = require('../../../core/auth/auth.middleware');
const { requireModuleAccess } = require('../../../core/rbac/rbac.middleware');
const inventorySettingsRoutes = require('./inventory-settings.routes');
const unitsOfMeasureRoutes = require('./units-of-measure.routes');
const productCategoriesRoutes = require('./product-categories.routes');
const warehousesRoutes = require('./warehouses.routes');
const productsRoutes = require('./products.routes');
const bomRoutes = require('./bom.routes');
const inventoryMovementsRoutes = require('./inventory-movements.routes');
const transfersRoutes = require('./transfers.routes');
const physicalCountsRoutes = require('./physical-counts.routes');
const stockLevelsRoutes = require('./stock-levels.routes');
const purchaseOrdersRoutes = require('./purchase-orders.routes');
const lotTraceabilityRoutes = require('./lot-traceability.routes');

const router = Router();

router.use(requireAuth);
router.use(requireModuleAccess('inventory'));
router.use('/settings', inventorySettingsRoutes);
router.use('/units-of-measure', unitsOfMeasureRoutes);
router.use('/categories', productCategoriesRoutes);
router.use('/warehouses', warehousesRoutes);
router.use('/products', productsRoutes);
router.use('/bom', bomRoutes);
router.use('/movements', inventoryMovementsRoutes);
router.use('/transfers', transfersRoutes);
router.use('/physical-counts', physicalCountsRoutes);
router.use('/stock-levels', stockLevelsRoutes);
router.use('/purchase-orders', purchaseOrdersRoutes);
router.use('/lots', lotTraceabilityRoutes);

module.exports = router;
