const asyncHandler = require('../../../core/utils/asyncHandler');
const service = require('../services/business-metrics.service');

const create = asyncHandler(async (req, res) => {
  const metric = await service.createMetric(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(metric);
});

const list = asyncHandler(async (req, res) => {
  const metrics = await service.listMetrics(req.auth.companyId, req.query);
  res.json(metrics);
});

const update = asyncHandler(async (req, res) => {
  const metric = await service.updateMetric(req.auth.companyId, req.params.id, req.body);
  res.json(metric);
});

const addEntry = asyncHandler(async (req, res) => {
  const entry = await service.addEntry(req.auth.companyId, req.auth.userId, req.params.id, req.body);
  res.status(201).json(entry);
});

const listEntries = asyncHandler(async (req, res) => {
  const entries = await service.listEntries(req.auth.companyId, req.params.id, req.query);
  res.json(entries);
});

const deleteEntry = asyncHandler(async (req, res) => {
  await service.deleteEntry(req.auth.companyId, req.params.id, req.params.entryId);
  res.status(204).send();
});

const getStats = asyncHandler(async (req, res) => {
  const stats = await service.getMetricStats(req.auth.companyId, req.params.id, req.query);
  res.json(stats);
});

module.exports = { create, list, update, addEntry, listEntries, deleteEntry, getStats };
