const asyncHandler = require('../../../core/utils/asyncHandler');
const riskRulesService = require('../services/fiscal-risk-rules.service');

const create = asyncHandler(async (req, res) => {
  const rule = await riskRulesService.createRule(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(rule);
});

const update = asyncHandler(async (req, res) => {
  const rule = await riskRulesService.updateRule(req.auth.companyId, req.params.id, req.auth.userId, req.body);
  res.json(rule);
});

const list = asyncHandler(async (req, res) => {
  const rules = await riskRulesService.listRules(req.auth.companyId, req.query);
  res.json(rules);
});

module.exports = { create, update, list };
