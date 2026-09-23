const asyncHandler = require('../../../core/utils/asyncHandler');
const varianceService = require('../services/budget-variance.service');

const getSettings = asyncHandler(async (req, res) => {
  const settings = await varianceService.getFpaSettings(req.auth.companyId);
  res.json(settings);
});

const updateSettings = asyncHandler(async (req, res) => {
  const settings = await varianceService.updateFpaSettings(req.auth.companyId, req.auth.userId, req.body);
  res.json(settings);
});

const getReport = asyncHandler(async (req, res) => {
  const report = await varianceService.getBudgetVarianceReport(req.auth.companyId, req.params.budgetId);
  res.json(report);
});

const justify = asyncHandler(async (req, res) => {
  const justification = await varianceService.submitJustification(
    req.auth.companyId,
    req.params.lineId,
    req.auth.userId,
    req.body.comment
  );
  res.status(201).json(justification);
});

const listJustifications = asyncHandler(async (req, res) => {
  const justifications = await varianceService.listJustifications(req.auth.companyId, req.params.lineId);
  res.json(justifications);
});

module.exports = { getSettings, updateSettings, getReport, justify, listJustifications };
