const asyncHandler = require('../../../core/utils/asyncHandler');
const vendorsService = require('../services/vendors.service');

const create = asyncHandler(async (req, res) => {
  const vendor = await vendorsService.createVendor(req.auth.companyId, req.body, req.auth.userId);
  res.status(201).json(vendor);
});

const update = asyncHandler(async (req, res) => {
  const vendor = await vendorsService.updateVendor(req.auth.companyId, req.params.id, req.body, req.auth.userId);
  res.json(vendor);
});

const list = asyncHandler(async (req, res) => {
  const vendors = await vendorsService.listVendors(req.auth.companyId, req.query);
  res.json(vendors);
});

const getOne = asyncHandler(async (req, res) => {
  const vendor = await vendorsService.getVendor(req.auth.companyId, req.params.id);
  res.json(vendor);
});

module.exports = { create, update, list, getOne };
