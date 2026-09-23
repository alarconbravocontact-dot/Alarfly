const asyncHandler = require('../../../core/utils/asyncHandler');
const fiscalTransactionsService = require('../services/fiscal-transactions.service');

const create = asyncHandler(async (req, res) => {
  const transaction = await fiscalTransactionsService.createFiscalTransaction(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(transaction);
});

const getOne = asyncHandler(async (req, res) => {
  const transaction = await fiscalTransactionsService.getFiscalTransaction(req.auth.companyId, req.params.id);
  res.json(transaction);
});

const list = asyncHandler(async (req, res) => {
  const transactions = await fiscalTransactionsService.listFiscalTransactions(req.auth.companyId, req.query);
  res.json(transactions);
});

module.exports = { create, getOne, list };
