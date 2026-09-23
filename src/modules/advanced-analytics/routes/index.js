const { Router } = require('express');
const { requireAuth, requireRole } = require('../../../core/auth/auth.middleware');
const { requireModuleAccess } = require('../../../core/rbac/rbac.middleware');
const validate = require('../../../core/middlewares/validate');
const controller = require('../controllers/advanced-analytics.controller');
const {
  runAnalysisSchema,
  upsertAutomationConfigSchema,
  analysisTypeParamSchema,
  setCostClassificationSchema,
  upsertBenchmarkSchema,
  metricKeyParamSchema,
  listReportsQuerySchema,
  exportReportQuerySchema,
} = require('../validators/advanced-analytics.validator');

const router = Router();

// Matriz de permisos fina de este módulo, ya aprobada:
// - Los 3 roles que entran al módulo (Administrador/Contador/Financiero)
//   pueden ver todo (catálogo, configuración, reportes archivados,
//   valores de benchmarking).
// - Ejecutar un análisis manual y configurar la automatización es solo
//   Administrador/Financiero — el Contador queda en modo lectura.
// - Editar los valores de referencia de industria es solo Administrador.
const canRunAndConfigure = requireRole('ADMIN', 'FINANCE');
const canEditBenchmarks = requireRole('ADMIN');

router.use(requireAuth);
router.use(requireModuleAccess('advanced-analytics'));

router.get('/catalog', controller.getCatalog);

router.post('/run', canRunAndConfigure, validate(runAnalysisSchema), controller.runAnalysis);

router.get('/automation-config', controller.listAutomationConfigs);
router.patch(
  '/automation-config/:analysisType',
  canRunAndConfigure,
  validate(analysisTypeParamSchema, 'params'),
  validate(upsertAutomationConfigSchema),
  controller.upsertAutomationConfig
);

router.get('/cost-classifications', controller.listCostClassifications);
router.patch('/cost-classifications/:accountId', canRunAndConfigure, validate(setCostClassificationSchema), controller.setCostClassification);
router.delete('/cost-classifications/:accountId', canRunAndConfigure, controller.removeCostClassification);

router.get('/benchmark-values', controller.listBenchmarks);
router.patch(
  '/benchmark-values/:metricKey',
  canEditBenchmarks,
  validate(metricKeyParamSchema, 'params'),
  validate(upsertBenchmarkSchema),
  controller.upsertBenchmark
);
router.delete('/benchmark-values/:metricKey', canEditBenchmarks, validate(metricKeyParamSchema, 'params'), controller.deleteBenchmark);

router.get('/reports', validate(listReportsQuerySchema, 'query'), controller.listReports);
router.get('/reports/:id', controller.getReport);
router.get('/reports/:id/export', validate(exportReportQuerySchema, 'query'), controller.exportReport);

module.exports = router;
