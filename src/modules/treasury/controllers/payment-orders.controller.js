const asyncHandler = require('../../../core/utils/asyncHandler');
const paymentOrdersService = require('../services/payment-orders.service');

const create = asyncHandler(async (req, res) => {
  const order = await paymentOrdersService.createPaymentOrder(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(order);
});

const createForVendorBills = asyncHandler(async (req, res) => {
  const order = await paymentOrdersService.createPaymentOrderForVendorBills(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(order);
});

const submit = asyncHandler(async (req, res) => {
  const order = await paymentOrdersService.submitForApproval(req.auth.companyId, req.params.id, req.auth.userId);
  res.json(order);
});

const decide = asyncHandler(async (req, res) => {
  const order = await paymentOrdersService.decideApproval(req.auth.companyId, req.params.id, req.auth.userId, req.body);
  res.json(order);
});

const cancel = asyncHandler(async (req, res) => {
  const order = await paymentOrdersService.cancelPaymentOrder(req.auth.companyId, req.params.id, req.auth.userId);
  res.json(order);
});

const list = asyncHandler(async (req, res) => {
  const orders = await paymentOrdersService.listPaymentOrders(req.auth.companyId, req.query);
  res.json(orders);
});

const getOne = asyncHandler(async (req, res) => {
  const order = await paymentOrdersService.getPaymentOrder(req.auth.companyId, req.params.id);
  res.json(order);
});

module.exports = { create, createForVendorBills, submit, decide, cancel, list, getOne };
