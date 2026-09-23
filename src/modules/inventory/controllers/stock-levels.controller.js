const asyncHandler = require('../../../core/utils/asyncHandler');
const stockLevelsService = require('../services/stock-levels.service');

const getOne = asyncHandler(async (req, res) => {
  const level = await stockLevelsService.getStockLevel(req.auth.companyId, req.query.variantId, req.query.warehouseId);
  res.json(level);
});

const list = asyncHandler(async (req, res) => {
  const levels = await stockLevelsService.listStockLevels(req.auth.companyId, req.query);
  res.json(levels);
});

const valuation = asyncHandler(async (req, res) => {
  const result = await stockLevelsService.getInventoryValuation(req.auth.companyId, req.query);
  res.json(result);
});

const cost = asyncHandler(async (req, res) => {
  const result = await stockLevelsService.getProductUnitCost(req.auth.companyId, req.query.variantId, req.query.warehouseId);
  res.json(result);
});

module.exports = { getOne, list, valuation, cost };
