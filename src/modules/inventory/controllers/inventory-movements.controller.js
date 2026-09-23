const asyncHandler = require('../../../core/utils/asyncHandler');
const movementsService = require('../services/inventory-movements.service');

const createEntry = asyncHandler(async (req, res) => {
  const result = await movementsService.createEntry(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(result);
});

const createExit = asyncHandler(async (req, res) => {
  const result = await movementsService.createExit(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(result);
});

const createAdjustment = asyncHandler(async (req, res) => {
  const result = await movementsService.createAdjustment(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(result);
});

const list = asyncHandler(async (req, res) => {
  const movements = await movementsService.listMovements(req.auth.companyId, req.query);
  res.json(movements);
});

module.exports = { createEntry, createExit, createAdjustment, list };
