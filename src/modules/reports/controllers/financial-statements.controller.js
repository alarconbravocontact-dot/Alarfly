const asyncHandler = require('../../../core/utils/asyncHandler');
const financialStatementsService = require('../services/financial-statements.service');

const balanceSheet = asyncHandler(async (req, res) => {
  const asOfDate = req.query.asOfDate || new Date();
  const report = await financialStatementsService.getBalanceSheet(req.auth.companyId, asOfDate);
  res.json(report);
});

const incomeStatement = asyncHandler(async (req, res) => {
  const report = await financialStatementsService.getIncomeStatement(req.auth.companyId, req.query);
  res.json(report);
});

const drillDown = asyncHandler(async (req, res) => {
  const report = await financialStatementsService.drillDownAccount(req.auth.companyId, req.params.accountId, req.query);
  res.json(report);
});

const transactionsByType = asyncHandler(async (req, res) => {
  const { type, from, to } = req.query;
  const report = await financialStatementsService.getTransactionsByType(req.auth.companyId, type, { from, to });
  res.json(report);
});

const compareIncomeStatement = asyncHandler(async (req, res) => {
  const { fromA, toA, fromB, toB } = req.query;
  const report = await financialStatementsService.compareIncomeStatements(
    req.auth.companyId,
    { from: fromA, to: toA },
    { from: fromB, to: toB }
  );
  res.json(report);
});

const compareBalanceSheet = asyncHandler(async (req, res) => {
  const { asOfDateA, asOfDateB } = req.query;
  const report = await financialStatementsService.compareBalanceSheets(req.auth.companyId, asOfDateA, asOfDateB);
  res.json(report);
});

module.exports = {
  balanceSheet,
  incomeStatement,
  drillDown,
  transactionsByType,
  compareIncomeStatement,
  compareBalanceSheet,
};
