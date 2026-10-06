const app = require('./app');
const config = require('./core/config');
const fxCron = require('./core/fx/fx.cron');
const fixedAssetsCron = require('./modules/accounting/services/fixed-assets.cron');
const alertsCron = require('./modules/treasury/services/alerts.cron');
const fiscalAlertsCron = require('./modules/fiscal/services/fiscal-alerts.cron');
const scheduledReportsCron = require('./modules/reports/services/scheduled-reports.cron');
const inventoryAlertsCron = require('./modules/inventory/services/inventory-alerts.cron');
const arCollectionsCron = require('./modules/accounts-receivable/services/ar-collections.cron');
const advancedAnalyticsCron = require('./modules/advanced-analytics/services/advanced-analytics.cron');
const arRecurringCron = require('./modules/accounts-receivable/services/ar-recurring.cron');
const personalAlertsCron = require('./modules/personal/services/personal-alerts.cron');

app.listen(config.port, () => {
  console.log(`Alarfly corriendo en el puerto ${config.port}`);
});

// Los jobs automáticos solo corren en el proceso real del servidor, no
// en los tests (que solo importan src/app.js).
fxCron.schedule();
fixedAssetsCron.schedule();
alertsCron.schedule();
fiscalAlertsCron.schedule();
scheduledReportsCron.schedule();
inventoryAlertsCron.schedule();
arCollectionsCron.schedule();
advancedAnalyticsCron.schedule();
arRecurringCron.schedule();
personalAlertsCron.schedule();
