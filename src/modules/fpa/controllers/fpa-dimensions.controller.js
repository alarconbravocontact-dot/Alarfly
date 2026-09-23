const asyncHandler = require('../../../core/utils/asyncHandler');
const dimensionsService = require('../services/fpa-dimensions.service');

const create = asyncHandler(async (req, res) => {
  const dimension = await dimensionsService.createDimension(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(dimension);
});

const update = asyncHandler(async (req, res) => {
  const dimension = await dimensionsService.updateDimension(req.auth.companyId, req.params.id, req.auth.userId, req.body);
  res.json(dimension);
});

const remove = asyncHandler(async (req, res) => {
  await dimensionsService.deleteDimension(req.auth.companyId, req.params.id, req.auth.userId);
  res.status(204).send();
});

const list = asyncHandler(async (req, res) => {
  const dimensions = await dimensionsService.listDimensions(req.auth.companyId, req.query);
  res.json(dimensions);
});

const tree = asyncHandler(async (req, res) => {
  const dimensions = await dimensionsService.getDimensionTree(req.auth.companyId);
  res.json(dimensions);
});

const getOne = asyncHandler(async (req, res) => {
  const dimension = await dimensionsService.getDimension(req.auth.companyId, req.params.id);
  res.json(dimension);
});

const tagLine = asyncHandler(async (req, res) => {
  const tag = await dimensionsService.tagJournalEntryLine(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(tag);
});

const untagLine = asyncHandler(async (req, res) => {
  await dimensionsService.untagJournalEntryLine(req.auth.companyId, req.auth.userId, req.params.tagId);
  res.status(204).send();
});

module.exports = { create, update, remove, list, tree, getOne, tagLine, untagLine };
