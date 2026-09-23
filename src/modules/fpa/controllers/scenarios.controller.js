const asyncHandler = require('../../../core/utils/asyncHandler');
const scenariosService = require('../services/scenarios.service');

const simulate = asyncHandler(async (req, res) => {
  const result = await scenariosService.simulateScenario(req.auth.companyId, req.body);
  res.json(result);
});

const save = asyncHandler(async (req, res) => {
  const scenario = await scenariosService.saveScenario(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(scenario);
});

const list = asyncHandler(async (req, res) => {
  const scenarios = await scenariosService.listScenarios(req.auth.companyId);
  res.json(scenarios);
});

const getOne = asyncHandler(async (req, res) => {
  const scenario = await scenariosService.getScenario(req.auth.companyId, req.params.id);
  res.json(scenario);
});

module.exports = { simulate, save, list, getOne };
