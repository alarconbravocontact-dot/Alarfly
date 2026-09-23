const asyncHandler = require('../../../core/utils/asyncHandler');
const creditCardService = require('../services/credit-card.service');

const importStatement = asyncHandler(async (req, res) => {
  const result = await creditCardService.importCardStatement(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(result);
});

const list = asyncHandler(async (req, res) => {
  const transactions = await creditCardService.listCardTransactions(req.auth.companyId, req.query);
  res.json(transactions);
});

const flag = asyncHandler(async (req, res) => {
  const transaction = await creditCardService.flagTransaction(req.auth.companyId, req.params.id, req.auth.userId, req.body);
  res.json(transaction);
});

const matchPettyCash = asyncHandler(async (req, res) => {
  const transaction = await creditCardService.matchWithPettyCashExpense(
    req.auth.companyId,
    req.params.id,
    req.auth.userId,
    req.body.pettyCashExpenseId
  );
  res.json(transaction);
});

module.exports = { importStatement, list, flag, matchPettyCash };
