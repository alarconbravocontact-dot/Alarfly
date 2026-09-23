const asyncHandler = require('../../../core/utils/asyncHandler');
const bomService = require('../services/bom.service');

const create = asyncHandler(async (req, res) => {
  const bom = await bomService.createBom(req.auth.companyId, req.body);
  res.status(201).json(bom);
});

const getOne = asyncHandler(async (req, res) => {
  const bom = await bomService.getBom(req.auth.companyId, req.params.parentVariantId);
  res.json(bom);
});

const deactivate = asyncHandler(async (req, res) => {
  const bom = await bomService.deactivateBom(req.auth.companyId, req.params.parentVariantId);
  res.json(bom);
});

module.exports = { create, getOne, deactivate };
