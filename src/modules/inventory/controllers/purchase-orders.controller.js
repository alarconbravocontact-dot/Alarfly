const asyncHandler = require('../../../core/utils/asyncHandler');
const purchaseOrdersService = require('../services/purchase-orders.service');
const inventoryAlertsService = require('../services/inventory-alerts.service');

const create = asyncHandler(async (req, res) => {
  const order = await purchaseOrdersService.createPurchaseOrder(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(order);
});

const submit = asyncHandler(async (req, res) => {
  const order = await purchaseOrdersService.submitPurchaseOrder(req.auth.companyId, req.auth.userId, req.params.id);
  res.json(order);
});

const receive = asyncHandler(async (req, res) => {
  const result = await purchaseOrdersService.receivePurchaseOrder(req.auth.companyId, req.auth.userId, req.params.id, req.body);
  res.json(result);
});

const cancel = asyncHandler(async (req, res) => {
  const order = await purchaseOrdersService.cancelPurchaseOrder(req.auth.companyId, req.auth.userId, req.params.id);
  res.json(order);
});

const getOne = asyncHandler(async (req, res) => {
  const order = await purchaseOrdersService.getPurchaseOrder(req.auth.companyId, req.params.id);
  res.json(order);
});

const list = asyncHandler(async (req, res) => {
  const orders = await purchaseOrdersService.listPurchaseOrders(req.auth.companyId, req.query);
  res.json(orders);
});

const scan = asyncHandler(async (req, res) => {
  const result = await inventoryAlertsService.runInventoryAlertsScan(req.auth.companyId, req.auth.userId);
  res.json(result);
});

module.exports = { create, submit, receive, cancel, getOne, list, scan };
