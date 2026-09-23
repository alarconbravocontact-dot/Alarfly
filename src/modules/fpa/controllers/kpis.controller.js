const asyncHandler = require('../../../core/utils/asyncHandler');
const kpisService = require('../services/kpis.service');

const getEbitda = asyncHandler(async (req, res) => {
  const result = await kpisService.getEbitda(req.auth.companyId, req.query);
  res.json(result);
});

const getBurnRateAndRunway = asyncHandler(async (req, res) => {
  const result = await kpisService.getBurnRateAndRunway(req.auth.companyId, req.query);
  res.json(result);
});

const create = asyncHandler(async (req, res) => {
  const kpi = await kpisService.createKpiDefinition(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(kpi);
});

const list = asyncHandler(async (req, res) => {
  const kpis = await kpisService.listKpiDefinitions(req.auth.companyId, req.query);
  res.json(kpis);
});

const evaluate = asyncHandler(async (req, res) => {
  const result = await kpisService.evaluateKpi(req.auth.companyId, req.params.id, req.query);
  res.json(result);
});

const compare = asyncHandler(async (req, res) => {
  const { fromA, toA, fromB, toB } = req.query;
  const result = await kpisService.compareKpi(req.auth.companyId, req.params.id, { from: fromA, to: toA }, { from: fromB, to: toB });
  res.json(result);
});

module.exports = { getEbitda, getBurnRateAndRunway, create, list, evaluate, compare };
