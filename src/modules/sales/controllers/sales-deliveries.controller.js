const asyncHandler = require('../../../core/utils/asyncHandler');
const salesDeliveriesService = require('../services/sales-deliveries.service');

const create = asyncHandler(async (req, res) => {
  const delivery = await salesDeliveriesService.createSalesDelivery(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(delivery);
});

const confirm = asyncHandler(async (req, res) => {
  const delivery = await salesDeliveriesService.confirmDelivery(req.auth.companyId, req.auth.userId, req.params.id);
  res.json(delivery);
});

const cancel = asyncHandler(async (req, res) => {
  const delivery = await salesDeliveriesService.cancelDelivery(req.auth.companyId, req.auth.userId, req.params.id, req.body.reason);
  res.json(delivery);
});

const list = asyncHandler(async (req, res) => {
  const deliveries = await salesDeliveriesService.listSalesDeliveries(req.auth.companyId, req.query);
  res.json(deliveries);
});

const getOne = asyncHandler(async (req, res) => {
  const delivery = await salesDeliveriesService.getSalesDelivery(req.auth.companyId, req.params.id);
  res.json(delivery);
});

module.exports = { create, confirm, cancel, list, getOne };
