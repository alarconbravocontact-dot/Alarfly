const asyncHandler = require('../../../core/utils/asyncHandler');
const arInvoicesService = require('../services/ar-invoices.service');

const create = asyncHandler(async (req, res) => {
  const invoice = await arInvoicesService.createInvoice(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(invoice);
});

const getOne = asyncHandler(async (req, res) => {
  const invoice = await arInvoicesService.getInvoice(req.auth.companyId, req.params.id);
  res.json(invoice);
});

const list = asyncHandler(async (req, res) => {
  const invoices = await arInvoicesService.listInvoices(req.auth.companyId, req.query);
  res.json(invoices);
});

const salesTrend = asyncHandler(async (req, res) => {
  const trend = await arInvoicesService.getSalesTrend(req.auth.companyId, req.query);
  res.json(trend);
});

module.exports = { create, getOne, list, salesTrend };
