const asyncHandler = require('../../../core/utils/asyncHandler');
const payrollService = require('../services/payroll.service');

const create = asyncHandler(async (req, res) => {
  const payroll = await payrollService.createPayroll(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(payroll);
});

const list = asyncHandler(async (req, res) => {
  const payrolls = await payrollService.listPayrolls(req.auth.companyId, req.query);
  res.json(payrolls);
});

const getOne = asyncHandler(async (req, res) => {
  const payroll = await payrollService.getPayroll(req.auth.companyId, req.params.id);
  res.json(payroll);
});

const calculate = asyncHandler(async (req, res) => {
  const payroll = await payrollService.calculatePayroll(req.auth.companyId, req.params.id, req.auth.userId, req.body);
  res.json(payroll);
});

const updateItem = asyncHandler(async (req, res) => {
  const item = await payrollService.updatePayrollItem(req.auth.companyId, req.params.id, req.params.itemId, req.auth.userId, req.body);
  res.json(item);
});

const review = asyncHandler(async (req, res) => {
  const payroll = await payrollService.reviewPayroll(req.auth.companyId, req.params.id, req.auth.userId);
  res.json(payroll);
});

const sendBackToDraft = asyncHandler(async (req, res) => {
  const payroll = await payrollService.sendBackToDraft(req.auth.companyId, req.params.id, req.auth.userId);
  res.json(payroll);
});

const sendBackToCalculated = asyncHandler(async (req, res) => {
  const payroll = await payrollService.sendBackToCalculated(req.auth.companyId, req.params.id, req.auth.userId);
  res.json(payroll);
});

const approve = asyncHandler(async (req, res) => {
  const payroll = await payrollService.approvePayroll(req.auth.companyId, req.params.id, req.auth.userId);
  res.json(payroll);
});

const pay = asyncHandler(async (req, res) => {
  const payroll = await payrollService.payPayroll(req.auth.companyId, req.params.id, req.auth.userId, req.body);
  res.json(payroll);
});

module.exports = { create, list, getOne, calculate, updateItem, review, sendBackToDraft, sendBackToCalculated, approve, pay };
