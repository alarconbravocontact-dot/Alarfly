const asyncHandler = require('../../../core/utils/asyncHandler');
const salesOrdersService = require('../services/sales-orders.service');

const create = asyncHandler(async (req, res) => {
  const order = await salesOrdersService.createSalesOrder(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(order);
});

const confirm = asyncHandler(async (req, res) => {
  const order = await salesOrdersService.confirmSalesOrder(req.auth.companyId, req.auth.userId, req.params.id);
  res.json(order);
});

const cancel = asyncHandler(async (req, res) => {
  const order = await salesOrdersService.cancelSalesOrder(req.auth.companyId, req.auth.userId, req.params.id, req.body.reason);
  res.json(order);
});

const list = asyncHandler(async (req, res) => {
  const orders = await salesOrdersService.listSalesOrders(req.auth.companyId, req.query);
  res.json(orders);
});

const getOne = asyncHandler(async (req, res) => {
  const order = await salesOrdersService.getSalesOrder(req.auth.companyId, req.params.id);
  res.json(order);
});

module.exports = { create, confirm, cancel, list, getOne };
