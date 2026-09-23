const asyncHandler = require('../../../core/utils/asyncHandler');
const ledgerService = require('../../../core/ledger/ledger.service');

const create = asyncHandler(async (req, res) => {
  const entry = await ledgerService.postEntry({
    companyId: req.auth.companyId,
    createdByUserId: req.auth.userId,
    origin: 'MANUAL',
    ...req.body,
  });
  res.status(201).json(entry);
});

const list = asyncHandler(async (req, res) => {
  const entries = await ledgerService.listEntries(req.auth.companyId, req.query);
  res.json(entries);
});

const getOne = asyncHandler(async (req, res) => {
  const entry = await ledgerService.getEntry(req.auth.companyId, req.params.id);
  res.json(entry);
});

const submit = asyncHandler(async (req, res) => {
  const entry = await ledgerService.submitForApproval(req.auth.companyId, req.params.id, req.auth.userId);
  res.json(entry);
});

const approve = asyncHandler(async (req, res) => {
  const entry = await ledgerService.approveEntry(req.auth.companyId, req.params.id, req.auth.userId);
  res.json(entry);
});

const remove = asyncHandler(async (req, res) => {
  await ledgerService.deleteDraft(req.auth.companyId, req.params.id, req.auth.userId);
  res.status(204).send();
});

const reverse = asyncHandler(async (req, res) => {
  const reversal = await ledgerService.reverseEntry(req.auth.companyId, req.params.id, req.auth.userId, req.body);
  res.status(201).json(reversal);
});

module.exports = { create, list, getOne, submit, approve, remove, reverse };
