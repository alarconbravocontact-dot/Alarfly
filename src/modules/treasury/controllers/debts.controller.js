const asyncHandler = require('../../../core/utils/asyncHandler');
const debtsService = require('../services/debts.service');

const create = asyncHandler(async (req, res) => {
  const debt = await debtsService.createDebt(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(debt);
});

const disburse = asyncHandler(async (req, res) => {
  const debt = await debtsService.disburseLoan(req.auth.companyId, req.params.id, req.auth.userId);
  res.json(debt);
});

const drawdown = asyncHandler(async (req, res) => {
  const debt = await debtsService.drawdown(req.auth.companyId, req.params.id, req.auth.userId, req.body.amount, req.body.date);
  res.json(debt);
});

const repay = asyncHandler(async (req, res) => {
  const debt = await debtsService.repayCreditLine(req.auth.companyId, req.params.id, req.auth.userId, req.body.amount, req.body.date);
  res.json(debt);
});

const payInstallment = asyncHandler(async (req, res) => {
  const installment = await debtsService.payInstallment(req.auth.companyId, req.params.id, req.params.installmentId, req.auth.userId);
  res.json(installment);
});

const list = asyncHandler(async (req, res) => {
  const debts = await debtsService.listDebts(req.auth.companyId, req.query);
  res.json(debts);
});

const getOne = asyncHandler(async (req, res) => {
  const debt = await debtsService.getDebt(req.auth.companyId, req.params.id);
  res.json(debt);
});

module.exports = { create, disburse, drawdown, repay, payInstallment, list, getOne };
