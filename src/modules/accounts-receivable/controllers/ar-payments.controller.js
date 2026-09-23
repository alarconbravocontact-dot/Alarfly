const asyncHandler = require('../../../core/utils/asyncHandler');
const arPaymentsService = require('../services/ar-payments.service');

const create = asyncHandler(async (req, res) => {
  const payment = await arPaymentsService.recordPayment(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(payment);
});

const applyAdvance = asyncHandler(async (req, res) => {
  const payment = await arPaymentsService.applyAdvancePayment(req.auth.companyId, req.auth.userId, req.params.id, req.body.applications);
  res.json(payment);
});

const getOne = asyncHandler(async (req, res) => {
  const payment = await arPaymentsService.getPayment(req.auth.companyId, req.params.id);
  res.json(payment);
});

const list = asyncHandler(async (req, res) => {
  const payments = await arPaymentsService.listPayments(req.auth.companyId, req.query);
  res.json(payments);
});

module.exports = { create, applyAdvance, getOne, list };
