const asyncHandler = require('../../../core/utils/asyncHandler');
const rulesService = require('../services/payment-approval-rules.service');

const create = asyncHandler(async (req, res) => {
  const rule = await rulesService.createRule(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(rule);
});

const list = asyncHandler(async (req, res) => {
  const rules = await rulesService.listRules(req.auth.companyId, req.query);
  res.json(rules);
});

const getOne = asyncHandler(async (req, res) => {
  const rule = await rulesService.getRule(req.auth.companyId, req.params.id);
  res.json(rule);
});

const deactivate = asyncHandler(async (req, res) => {
  const rule = await rulesService.deactivateRule(req.auth.companyId, req.params.id, req.auth.userId);
  res.json(rule);
});

module.exports = { create, list, getOne, deactivate };
