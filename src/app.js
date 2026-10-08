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
const dashboardRoutes = require('./modules/reports/routes/dashboard.routes');
const financeRoutes = require('./modules/finance/routes');
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
const auditLogRoutes = require('./core/audit/audit.routes');
const jobsRoutes = require('./core/jobs/jobs.routes');
const affiliatesRoutes = require('./core/affiliates/affiliates.routes');
const affiliateAdminRoutes = require('./core/affiliates/affiliate-admin.routes');
const contactRoutes = require('./core/contact/contact.routes');
const membershipRoutes = require('./core/membership/membership.routes');
const membershipAdminRoutes = require('./core/membership/membership-admin.routes');
const personalRoutes = require('./modules/personal/routes');
const errorHandler = require('./core/middlewares/errorHandler');
const requestId = require('./core/middlewares/requestId');
const prisma = require('./core/database/prisma');

const app = express();

app.use(helmet());
app.use(cors());
app.use(requestId);
morgan.token('id', (req) => req.id);
app.use(morgan(':id :method :url :status :response-time ms - :res[content-length]'));
// Límite más alto que el default (100kb): los archivos bancarios
// importados (CSV/OFX/MT940) viajan como texto dentro del body JSON.
app.use(express.json({ limit: '5mb' }));

// Liveness: ¿el proceso de Node sigue vivo? A propósito NUNCA toca la
// base de datos — si Postgres está caído pero Node sigue respondiendo,
// reiniciar el proceso no arregla nada (mismo criterio que cualquier
// probe de liveness estándar). Sin autenticación: un balanceador/
// orquestador necesita poder pedirlo sin credenciales.
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// F15-E9: readiness — ¿puede este proceso atender peticiones de
// verdad ahora mismo? A diferencia de /health (liveness), sí depende
// de la base de datos: antes de este endpoint no había NINGUNA forma
// de distinguir "el proceso está vivo" de "el proceso está vivo pero
// no puede hacer nada útil porque Postgres no responde" — confirmado
// en este mismo entorno de desarrollo varias veces (el backend seguía
// respondiendo 200 en /health mientras Postgres estaba caído aparte).
app.get('/health/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', database: 'ok' });
  } catch {
    res.status(503).json({ status: 'not_ready', database: 'error' });
  }
});

app.use('/auth', authRoutes);
app.use('/accounting', accountingRoutes);
app.use('/treasury', treasuryRoutes);
app.use('/fpa', fpaRoutes);
app.use('/fiscal', fiscalRoutes);
// Fase 9: dashboardRoutes se monta ANTES del router de Reportes
// (gateado a ADMIN/FINANCE) — Express prueba primero las rutas de
// dashboardRoutes (/reports/dashboard*, con su propio requireAuth, sin
// gate de módulo) y solo si ninguna calza sigue con reportsRoutes. El
// resto de `/reports/*` sigue exactamente igual de protegido.
app.use('/reports', dashboardRoutes);
app.use('/reports', reportsRoutes);
app.use('/finance', financeRoutes);
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
app.use('/audit-log', auditLogRoutes);
app.use('/jobs', jobsRoutes);
app.use('/affiliates', affiliatesRoutes);
app.use('/affiliate-admin', affiliateAdminRoutes);
app.use('/membership', membershipRoutes);
app.use('/membership-admin', membershipAdminRoutes);
app.use('/contact', contactRoutes);
app.use('/personal', personalRoutes);

app.use(errorHandler);

module.exports = app;
