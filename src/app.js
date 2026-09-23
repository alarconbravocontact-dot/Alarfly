const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const authRoutes = require('./core/auth/auth.routes');
const accountingRoutes = require('./modules/accounting/routes');
const treasuryRoutes = require('./modules/treasury/routes');
const fpaRoutes = require('./modules/fpa/routes');
const fiscalRoutes = require('./modules/fiscal/routes');
const reportsRoutes = require('./modules/reports/routes');
const accountsReceivableRoutes = require('./modules/accounts-receivable/routes');
const accountsPayableRoutes = require('./modules/accounts-payable/routes');
const arApSettingsRoutes = require('./core/ar-ap-settings/ar-ap-settings.routes');
const inventoryRoutes = require('./modules/inventory/routes');
const salesRoutes = require('./modules/sales/routes');
const paymentMethodsRoutes = require('./core/payment-methods/payment-methods.routes');
const businessMetricsRoutes = require('./modules/business-metrics/routes');
const accessLevelsRoutes = require('./modules/access-levels/routes');
const juntaRoutes = require('./modules/junta/routes');
const accountRoutes = require('./core/account/routes');
const advancedAnalyticsRoutes = require('./modules/advanced-analytics/routes');
const savedViewsRoutes = require('./core/saved-views/saved-views.routes');
const tablePreferencesRoutes = require('./core/table-preferences/table-preferences.routes');
const recentlyUsedRoutes = require('./core/recently-used/recently-used.routes');
const panelPreferencesRoutes = require('./core/panel-preferences/panel-preferences.routes');
const viewPreferencesRoutes = require('./core/view-preferences/view-preferences.routes');
const importRoutes = require('./core/import/import.routes');
const importTemplatesRoutes = require('./core/import-templates/import-templates.routes');
const glossaryRoutes = require('./core/glossary/glossary.routes');
const notificationsRoutes = require('./core/alerts/alerts.routes');
const fxRoutes = require('./core/fx/fx.routes');
const pinnedItemsRoutes = require('./core/pinned-items/pinned-items.routes');
const helpRoutes = require('./core/help/help.routes');
const errorHandler = require('./core/middlewares/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
// Límite más alto que el default (100kb): los archivos bancarios
// importados (CSV/OFX/MT940) viajan como texto dentro del body JSON.
app.use(express.json({ limit: '5mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/accounting', accountingRoutes);
app.use('/treasury', treasuryRoutes);
app.use('/fpa', fpaRoutes);
app.use('/fiscal', fiscalRoutes);
app.use('/reports', reportsRoutes);
app.use('/accounts-receivable', accountsReceivableRoutes);
app.use('/accounts-payable', accountsPayableRoutes);
app.use('/ar-ap-settings', arApSettingsRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/sales', salesRoutes);
app.use('/payment-methods', paymentMethodsRoutes);
app.use('/business-metrics', businessMetricsRoutes);
app.use('/access-levels', accessLevelsRoutes);
app.use('/junta', juntaRoutes);
app.use('/account', accountRoutes);
app.use('/advanced-analytics', advancedAnalyticsRoutes);
app.use('/saved-views', savedViewsRoutes);
app.use('/table-preferences', tablePreferencesRoutes);
app.use('/recently-used', recentlyUsedRoutes);
app.use('/panel-preferences', panelPreferencesRoutes);
app.use('/view-preferences', viewPreferencesRoutes);
app.use('/import', importRoutes);
app.use('/import-templates', importTemplatesRoutes);
app.use('/glossary', glossaryRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/help', helpRoutes);
app.use('/fx', fxRoutes);
app.use('/pinned-items', pinnedItemsRoutes);

app.use(errorHandler);

module.exports = app;
