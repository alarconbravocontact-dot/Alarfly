const asyncHandler = require('../../../core/utils/asyncHandler');
const reconciliationService = require('../services/reconciliation.service');

const start = asyncHandler(async (req, res) => {
  const reconciliation = await reconciliationService.startReconciliation(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(reconciliation);
});

const list = asyncHandler(async (req, res) => {
  const reconciliations = await reconciliationService.listReconciliations(req.auth.companyId, req.query.treasuryAccountId);
  res.json(reconciliations);
});

const getOne = asyncHandler(async (req, res) => {
  const reconciliation = await reconciliationService.getReconciliation(req.auth.companyId, req.params.id);
  res.json(reconciliation);
});

const runAutoMatch = asyncHandler(async (req, res) => {
  const result = await reconciliationService.runAutomaticMatching(req.auth.companyId, req.params.id, req.auth.userId);
  res.json(result);
});

const manualMatch = asyncHandler(async (req, res) => {
  const match = await reconciliationService.manualMatch(req.auth.companyId, req.params.id, req.auth.userId, req.body);
  res.status(201).json(match);
});

const matchWithNewEntry = asyncHandler(async (req, res) => {
  const result = await reconciliationService.matchWithNewEntry(req.auth.companyId, req.params.id, req.auth.userId, req.body);
  res.status(201).json(result);
});

const reverseMatch = asyncHandler(async (req, res) => {
  const match = await reconciliationService.reverseMatch(req.auth.companyId, req.params.id, req.auth.userId, req.params.matchId);
  res.json(match);
});

const complete = asyncHandler(async (req, res) => {
  const result = await reconciliationService.completeReconciliation(req.auth.companyId, req.params.id, req.auth.userId);
  res.json(result);
});

const exceptions = asyncHandler(async (req, res) => {
  const transactions = await reconciliationService.listExceptions(req.auth.companyId, req.query.treasuryAccountId);
  res.json(transactions);
});

module.exports = { start, list, getOne, runAutoMatch, manualMatch, matchWithNewEntry, reverseMatch, complete, exceptions };
