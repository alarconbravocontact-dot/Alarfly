const asyncHandler = require('../../../core/utils/asyncHandler');
const transfersService = require('../services/transfers.service');

const create = asyncHandler(async (req, res) => {
  const transfer = await transfersService.createTransfer(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(transfer);
});

const getOne = asyncHandler(async (req, res) => {
  const transfer = await transfersService.getTransfer(req.auth.companyId, req.params.id);
  res.json(transfer);
});

const list = asyncHandler(async (req, res) => {
  const transfers = await transfersService.listTransfers(req.auth.companyId, req.query);
  res.json(transfers);
});

module.exports = { create, getOne, list };
