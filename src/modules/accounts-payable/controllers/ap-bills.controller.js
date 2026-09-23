const asyncHandler = require('../../../core/utils/asyncHandler');
const apBillsService = require('../services/ap-bills.service');

const create = asyncHandler(async (req, res) => {
  const bill = await apBillsService.createBill(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(bill);
});

const getOne = asyncHandler(async (req, res) => {
  const bill = await apBillsService.getBill(req.auth.companyId, req.params.id);
  res.json(bill);
});

const list = asyncHandler(async (req, res) => {
  const bills = await apBillsService.listBills(req.auth.companyId, req.query);
  res.json(bills);
});

module.exports = { create, getOne, list };
