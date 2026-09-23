const asyncHandler = require('../utils/asyncHandler');
const paymentMethodsService = require('./payment-methods.service');

const list = asyncHandler(async (req, res) => {
  const methods = await paymentMethodsService.listPaymentMethods(req.auth.companyId, req.query);
  res.json(methods);
});

const create = asyncHandler(async (req, res) => {
  const method = await paymentMethodsService.createPaymentMethod(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(method);
});

const update = asyncHandler(async (req, res) => {
  const method = await paymentMethodsService.updatePaymentMethod(req.auth.companyId, req.auth.userId, req.params.id, req.body);
  res.json(method);
});

module.exports = { list, create, update };
