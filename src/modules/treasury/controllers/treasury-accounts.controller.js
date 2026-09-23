const asyncHandler = require('../../../core/utils/asyncHandler');
const treasuryAccountsService = require('../services/treasury-accounts.service');

const create = asyncHandler(async (req, res) => {
  const account = await treasuryAccountsService.createTreasuryAccount(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(account);
});

const update = asyncHandler(async (req, res) => {
  const account = await treasuryAccountsService.updateTreasuryAccount(
    req.auth.companyId,
    req.params.id,
    req.auth.userId,
    req.body
  );
  res.json(account);
});

const list = asyncHandler(async (req, res) => {
  const accounts = await treasuryAccountsService.listTreasuryAccounts(req.auth.companyId, req.query);
  res.json(accounts);
});

const getOne = asyncHandler(async (req, res) => {
  const account = await treasuryAccountsService.getTreasuryAccount(req.auth.companyId, req.params.id);
  res.json(account);
});

const cashPosition = asyncHandler(async (req, res) => {
  const report = await treasuryAccountsService.getConsolidatedCashPosition(req.auth.companyId, req.query.asOfDate);
  res.json(report);
});

module.exports = { create, update, list, getOne, cashPosition };
