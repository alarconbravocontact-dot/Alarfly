const asyncHandler = require('../../../core/utils/asyncHandler');
const customersService = require('../services/customers.service');

const create = asyncHandler(async (req, res) => {
  const customer = await customersService.createCustomer(req.auth.companyId, req.body);
  res.status(201).json(customer);
});

const update = asyncHandler(async (req, res) => {
  const customer = await customersService.updateCustomer(req.auth.companyId, req.params.id, req.body);
  res.json(customer);
});

const list = asyncHandler(async (req, res) => {
  const customers = await customersService.listCustomers(req.auth.companyId, req.query);
  res.json(customers);
});

const getOne = asyncHandler(async (req, res) => {
  const customer = await customersService.getCustomer(req.auth.companyId, req.params.id);
  res.json(customer);
});

const block = asyncHandler(async (req, res) => {
  const customer = await customersService.blockCustomer(req.auth.companyId, req.params.id, req.auth.userId, req.body.reason);
  res.json(customer);
});

const unblock = asyncHandler(async (req, res) => {
  const customer = await customersService.unblockCustomer(req.auth.companyId, req.params.id, req.auth.userId);
  res.json(customer);
});

const importCustomers = asyncHandler(async (req, res) => {
  const result = await customersService.importCustomers(req.auth.companyId, req.body.rows);
  res.status(201).json(result);
});

module.exports = { create, update, list, getOne, block, unblock, importCustomers };
