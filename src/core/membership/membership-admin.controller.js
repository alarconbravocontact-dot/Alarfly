const asyncHandler = require('../utils/asyncHandler');
const service = require('./membership.service');

const listPendingPayments = asyncHandler(async (req, res) => {
  const payments = await service.listPendingPayments();
  res.json(payments);
});

const getPaymentProof = asyncHandler(async (req, res) => {
  const proof = await service.getPaymentProof(req.params.id);
  res.json(proof);
});

const decidePayment = asyncHandler(async (req, res) => {
  const result = await service.decidePayment(req.params.id, req.auth.userId, req.body);
  res.json(result);
});

module.exports = { listPendingPayments, getPaymentProof, decidePayment };
