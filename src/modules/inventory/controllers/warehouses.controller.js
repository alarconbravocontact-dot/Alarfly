const asyncHandler = require('../../../core/utils/asyncHandler');
const warehousesService = require('../services/warehouses.service');

const create = asyncHandler(async (req, res) => {
  const warehouse = await warehousesService.createWarehouse(req.auth.companyId, req.body);
  res.status(201).json(warehouse);
});

const update = asyncHandler(async (req, res) => {
  const warehouse = await warehousesService.updateWarehouse(req.auth.companyId, req.params.id, req.body);
  res.json(warehouse);
});

const list = asyncHandler(async (req, res) => {
  const warehouses = await warehousesService.listWarehouses(req.auth.companyId, req.query);
  res.json(warehouses);
});

const getOne = asyncHandler(async (req, res) => {
  const warehouse = await warehousesService.getWarehouse(req.auth.companyId, req.params.id);
  res.json(warehouse);
});

module.exports = { create, update, list, getOne };
