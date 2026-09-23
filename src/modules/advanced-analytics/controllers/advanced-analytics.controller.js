const asyncHandler = require('../../../core/utils/asyncHandler');
const auditService = require('../../../core/audit/audit.service');
const { listCatalog } = require('../services/analysis-catalog');
const analysisEngine = require('../services/analysis-engine.service');
const automationConfigService = require('../services/automation-config.service');
const costClassificationService = require('../services/cost-classification.service');
const benchmarkService = require('../services/benchmark.service');
const reportsArchiveService = require('../services/reports-archive.service');

const getCatalog = asyncHandler(async (req, res) => {
  res.json(listCatalog());
});

const runAnalysis = asyncHandler(async (req, res) => {
  const report = await analysisEngine.runAnalysis(req.auth.companyId, req.body.analysisType, req.body.parameters, {
    triggerSource: 'MANUAL',
    triggeredByUserId: req.auth.userId,
  });
  await auditService.log({
    companyId: req.auth.companyId,
    userId: req.auth.userId,
    action: 'advanced_analysis.manual_run',
    entityType: 'AnalysisReport',
    entityId: report.id,
    oldValue: null,
    newValue: { analysisType: req.body.analysisType, triggerSource: 'MANUAL' },
  });
  res.status(201).json(report);
});

const listAutomationConfigs = asyncHandler(async (req, res) => {
  res.json(await automationConfigService.listConfigs(req.auth.companyId));
});

const upsertAutomationConfig = asyncHandler(async (req, res) => {
  const config = await automationConfigService.upsertConfig(req.auth.companyId, req.auth.userId, req.params.analysisType, req.body);
  await auditService.log({
    companyId: req.auth.companyId,
    userId: req.auth.userId,
    action: 'advanced_analysis.automation_config_updated',
    entityType: 'AnalysisAutomationConfig',
    entityId: config.id,
    oldValue: null,
    newValue: req.body,
  });
  res.json(config);
});

const listCostClassifications = asyncHandler(async (req, res) => {
  res.json(await costClassificationService.listClassifications(req.auth.companyId));
});

const setCostClassification = asyncHandler(async (req, res) => {
  const classification = await costClassificationService.setClassification(req.auth.companyId, req.auth.userId, req.params.accountId, req.body.costBehavior);
  res.json(classification);
});

const removeCostClassification = asyncHandler(async (req, res) => {
  await costClassificationService.removeClassification(req.auth.companyId, req.params.accountId);
  res.status(204).send();
});

const listBenchmarks = asyncHandler(async (req, res) => {
  res.json(await benchmarkService.listBenchmarks(req.auth.companyId));
});

const upsertBenchmark = asyncHandler(async (req, res) => {
  const result = await benchmarkService.upsertBenchmark(req.auth.companyId, req.auth.userId, { metricKey: req.params.metricKey, ...req.body });
  res.json(result);
});

const deleteBenchmark = asyncHandler(async (req, res) => {
  await benchmarkService.deleteBenchmark(req.auth.companyId, req.params.metricKey);
  res.status(204).send();
});

const listReports = asyncHandler(async (req, res) => {
  res.json(await reportsArchiveService.listReports(req.auth.companyId, req.query));
});

const getReport = asyncHandler(async (req, res) => {
  res.json(await reportsArchiveService.getReport(req.auth.companyId, req.params.id));
});

const exportReport = asyncHandler(async (req, res) => {
  const { buffer, contentType, filename } = await reportsArchiveService.exportReport(req.auth.companyId, req.params.id, req.query.format);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

module.exports = {
  getCatalog,
  runAnalysis,
  listAutomationConfigs,
  upsertAutomationConfig,
  listCostClassifications,
  setCostClassification,
  removeCostClassification,
  listBenchmarks,
  upsertBenchmark,
  deleteBenchmark,
  listReports,
  getReport,
  exportReport,
};
