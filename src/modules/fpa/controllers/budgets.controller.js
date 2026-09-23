const asyncHandler = require('../../../core/utils/asyncHandler');
const budgetsService = require('../services/budgets.service');
const budgetLinesService = require('../services/budget-lines.service');

const create = asyncHandler(async (req, res) => {
  const budget = await budgetsService.createBudget(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(budget);
});

const list = asyncHandler(async (req, res) => {
  const budgets = await budgetsService.listBudgets(req.auth.companyId, req.query);
  res.json(budgets);
});

const getOne = asyncHandler(async (req, res) => {
  const budget = await budgetsService.getBudget(req.auth.companyId, req.params.id);
  res.json(budget);
});

const submitForReview = asyncHandler(async (req, res) => {
  const budget = await budgetsService.transitionBudget(req.auth.companyId, req.params.id, req.auth.userId, 'IN_REVIEW');
  res.json(budget);
});

const sendBackToDraft = asyncHandler(async (req, res) => {
  const budget = await budgetsService.transitionBudget(req.auth.companyId, req.params.id, req.auth.userId, 'DRAFT');
  res.json(budget);
});

const approve = asyncHandler(async (req, res) => {
  const budget = await budgetsService.transitionBudget(req.auth.companyId, req.params.id, req.auth.userId, 'APPROVED');
  res.json(budget);
});

const upsertLine = asyncHandler(async (req, res) => {
  const line = await budgetLinesService.upsertBudgetLine(req.auth.companyId, req.params.id, req.auth.userId, req.body);
  res.status(201).json(line);
});

const deleteLine = asyncHandler(async (req, res) => {
  await budgetLinesService.deleteBudgetLine(req.auth.companyId, req.params.id, req.params.lineId, req.auth.userId);
  res.status(204).send();
});

module.exports = { create, list, getOne, submitForReview, sendBackToDraft, approve, upsertLine, deleteLine };
