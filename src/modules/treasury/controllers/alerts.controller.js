const asyncHandler = require('../../../core/utils/asyncHandler');
const alertsService = require('../services/alerts.service');

const createRule = asyncHandler(async (req, res) => {
  const rule = await alertsService.createRule(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(rule);
});

const listRules = asyncHandler(async (req, res) => {
  const rules = await alertsService.listRules(req.auth.companyId, req.query);
  res.json(rules);
});

const deactivateRule = asyncHandler(async (req, res) => {
  const rule = await alertsService.deactivateRule(req.auth.companyId, req.params.id, req.auth.userId);
  res.json(rule);
});

const scan = asyncHandler(async (req, res) => {
  const result = await alertsService.runAlertsScan(req.auth.companyId);
  res.json(result);
});

const list = asyncHandler(async (req, res) => {
  const alerts = await alertsService.listAlerts(req.auth.companyId, req.query);
  res.json(alerts);
});

const acknowledge = asyncHandler(async (req, res) => {
  const alert = await alertsService.acknowledgeAlert(req.auth.companyId, req.params.id, req.auth.userId);
  res.json(alert);
});

module.exports = { createRule, listRules, deactivateRule, scan, list, acknowledge };
