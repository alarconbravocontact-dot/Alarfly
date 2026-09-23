const asyncHandler = require('../../../core/utils/asyncHandler');
const quickSaleService = require('../services/quick-sale.service');

const create = asyncHandler(async (req, res) => {
  const result = await quickSaleService.quickSale(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(result);
});

module.exports = { create };
