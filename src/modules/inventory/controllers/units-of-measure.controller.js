const asyncHandler = require('../../../core/utils/asyncHandler');
const unitsService = require('../services/units-of-measure.service');

const create = asyncHandler(async (req, res) => {
  const unit = await unitsService.createUnitOfMeasure(req.auth.companyId, req.body);
  res.status(201).json(unit);
});

const list = asyncHandler(async (req, res) => {
  const units = await unitsService.listUnitsOfMeasure(req.auth.companyId);
  res.json(units);
});

const getOne = asyncHandler(async (req, res) => {
  const unit = await unitsService.getUnitOfMeasure(req.auth.companyId, req.params.id);
  res.json(unit);
});

module.exports = { create, list, getOne };
