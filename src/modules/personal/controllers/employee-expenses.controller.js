const asyncHandler = require('../../../core/utils/asyncHandler');
const expensesService = require('../services/employee-expenses.service');

const register = asyncHandler(async (req, res) => {
  const expense = await expensesService.registerExpense(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(expense);
});

const list = asyncHandler(async (req, res) => {
  const expenses = await expensesService.listExpenses(req.auth.companyId, req.query);
  res.json(expenses);
});

const getOne = asyncHandler(async (req, res) => {
  const expense = await expensesService.getExpense(req.auth.companyId, req.params.id);
  res.json(expense);
});

const decide = asyncHandler(async (req, res) => {
  const expense = await expensesService.decideExpense(req.auth.companyId, req.params.id, req.auth.userId, req.body);
  res.json(expense);
});

const reimburse = asyncHandler(async (req, res) => {
  const expense = await expensesService.reimburseExpense(req.auth.companyId, req.params.id, req.auth.userId, req.body);
  res.json(expense);
});

module.exports = { register, list, getOne, decide, reimburse };
