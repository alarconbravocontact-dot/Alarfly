const asyncHandler = require('../../../core/utils/asyncHandler');
const dimensionsService = require('../../../core/dimensions/dimensions.service');

const create = asyncHandler(async (req, res) => {
  const dimension = await dimensionsService.create({ companyId: req.auth.companyId, ...req.body });
  res.status(201).json(dimension);
});

const list = asyncHandler(async (req, res) => {
  const dimensions = await dimensionsService.list(req.auth.companyId, req.query.type);
  res.json(dimensions);
});

const remove = asyncHandler(async (req, res) => {
  await dimensionsService.deactivate(req.auth.companyId, req.params.id);
  res.status(204).send();
});

module.exports = { create, list, remove };
