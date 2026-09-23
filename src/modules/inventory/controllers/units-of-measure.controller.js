const asyncHandler = require('../../../core/utils/asyncHandler');
const unitsService = require('../services/units-of-measure.service');

const create = asyncHandler(async (req, res) => {
  const unit = await unitsService.createUnitOfMeasure(req.auth.companyId, req.body, req.auth.userId);
  res.status(201).json(unit);
});

const update = asyncHandler(async (req, res) => {
  const unit = await unitsService.updateUnitOfMeasure(req.auth.companyId, req.params.id, req.body, req.auth.userId);
  res.json(unit);
});

const list = asyncHandler(async (req, res) => {
  const units = await unitsService.listUnitsOfMeasure(req.auth.companyId, req.query);
  res.json(units);
});

const getOne = asyncHandler(async (req, res) => {
  const unit = await unitsService.getUnitOfMeasure(req.auth.companyId, req.params.id);
  res.json(unit);
});

module.exports = { create, update, list, getOne };
