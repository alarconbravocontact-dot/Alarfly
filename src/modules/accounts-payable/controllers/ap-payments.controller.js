const asyncHandler = require('../../../core/utils/asyncHandler');
const apPaymentsService = require('../services/ap-payments.service');

const create = asyncHandler(async (req, res) => {
  const payment = await apPaymentsService.recordPayment(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(payment);
});

const getOne = asyncHandler(async (req, res) => {
  const payment = await apPaymentsService.getPayment(req.auth.companyId, req.params.id);
  res.json(payment);
});

const list = asyncHandler(async (req, res) => {
  const payments = await apPaymentsService.listPayments(req.auth.companyId, req.query);
  res.json(payments);
});

module.exports = { create, getOne, list };
