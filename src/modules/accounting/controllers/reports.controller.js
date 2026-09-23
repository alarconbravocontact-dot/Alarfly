const asyncHandler = require('../../../core/utils/asyncHandler');
const reportsService = require('../services/reports.service');

const generalLedger = asyncHandler(async (req, res) => {
  const report = await reportsService.getGeneralLedger(req.auth.companyId, req.params.accountId, req.query);
  res.json(report);
});

const trialBalance = asyncHandler(async (req, res) => {
  const asOfDate = req.query.asOfDate || new Date();
  const report = await reportsService.getTrialBalance(req.auth.companyId, asOfDate);
  res.json(report);
});

const incomeStatement = asyncHandler(async (req, res) => {
  const report = await reportsService.getIncomeStatement(req.auth.companyId, req.query);
  res.json(report);
});

const balanceSheet = asyncHandler(async (req, res) => {
  const asOfDate = req.query.asOfDate || new Date();
  const report = await reportsService.getBalanceSheet(req.auth.companyId, asOfDate);
  res.json(report);
});

const compareIncomeStatement = asyncHandler(async (req, res) => {
  const { fromA, toA, fromB, toB } = req.query;
  const report = await reportsService.compareIncomeStatements(
    req.auth.companyId,
    { from: fromA, to: toA },
    { from: fromB, to: toB }
  );
  res.json(report);
});

const compareBalanceSheet = asyncHandler(async (req, res) => {
  const { asOfDateA, asOfDateB } = req.query;
  const report = await reportsService.compareBalanceSheets(req.auth.companyId, asOfDateA, asOfDateB);
  res.json(report);
});

module.exports = {
  generalLedger,
  trialBalance,
  incomeStatement,
  balanceSheet,
  compareIncomeStatement,
  compareBalanceSheet,
};
