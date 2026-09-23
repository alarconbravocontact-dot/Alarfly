const asyncHandler = require('../../../core/utils/asyncHandler');
const pettyCashService = require('../services/petty-cash.service');

const createFund = asyncHandler(async (req, res) => {
  const fund = await pettyCashService.createFund(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(fund);
});

const listFunds = asyncHandler(async (req, res) => {
  const funds = await pettyCashService.listFunds(req.auth.companyId, req.query);
  res.json(funds);
});

const getFund = asyncHandler(async (req, res) => {
  const fund = await pettyCashService.getFund(req.auth.companyId, req.params.id);
  res.json(fund);
});

const replenish = asyncHandler(async (req, res) => {
  const fund = await pettyCashService.replenishFund(req.auth.companyId, req.params.id, req.auth.userId, req.body.amount, req.body.date);
  res.json(fund);
});

const registerExpense = asyncHandler(async (req, res) => {
  const expense = await pettyCashService.registerExpense(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(expense);
});

const decideExpense = asyncHandler(async (req, res) => {
  const expense = await pettyCashService.decideExpense(req.auth.companyId, req.params.id, req.auth.userId, req.body);
  res.json(expense);
});

const bulkDecideExpenses = asyncHandler(async (req, res) => {
  const { expenseIds, decision, rejectionReason } = req.body;
  const results = await pettyCashService.bulkDecideExpenses(req.auth.companyId, expenseIds, req.auth.userId, { decision, rejectionReason });
  res.json({ results });
});

const listExpenses = asyncHandler(async (req, res) => {
  const expenses = await pettyCashService.listExpenses(req.auth.companyId, req.query);
  res.json(expenses);
});

module.exports = { createFund, listFunds, getFund, replenish, registerExpense, decideExpense, bulkDecideExpenses, listExpenses };
