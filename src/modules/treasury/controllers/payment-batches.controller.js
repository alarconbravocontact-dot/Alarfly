const asyncHandler = require('../../../core/utils/asyncHandler');
const batchesService = require('../services/payment-batches.service');

const create = asyncHandler(async (req, res) => {
  const batch = await batchesService.createBatch(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(batch);
});

const addOrder = asyncHandler(async (req, res) => {
  const order = await batchesService.addOrderToBatch(req.auth.companyId, req.params.id, req.auth.userId, req.body.paymentOrderId);
  res.json(order);
});

const removeOrder = asyncHandler(async (req, res) => {
  const order = await batchesService.removeOrderFromBatch(req.auth.companyId, req.params.id, req.auth.userId, req.params.orderId);
  res.json(order);
});

const exportBatch = asyncHandler(async (req, res) => {
  const result = await batchesService.exportBatch(req.auth.companyId, req.params.id, req.auth.userId);
  res.json(result);
});

const list = asyncHandler(async (req, res) => {
  const batches = await batchesService.listBatches(req.auth.companyId, req.query);
  res.json(batches);
});

const getOne = asyncHandler(async (req, res) => {
  const batch = await batchesService.getBatch(req.auth.companyId, req.params.id);
  res.json(batch);
});

module.exports = { create, addOrder, removeOrder, exportBatch, list, getOne };
