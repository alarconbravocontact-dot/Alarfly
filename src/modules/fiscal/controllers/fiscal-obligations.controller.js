const asyncHandler = require('../../../core/utils/asyncHandler');
const obligationsService = require('../services/fiscal-obligations.service');
const alertsService = require('../services/fiscal-alerts.service');

const create = asyncHandler(async (req, res) => {
  const obligation = await obligationsService.createObligation(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(obligation);
});

const update = asyncHandler(async (req, res) => {
  const obligation = await obligationsService.updateObligation(req.auth.companyId, req.params.id, req.auth.userId, req.body);
  res.json(obligation);
});

const list = asyncHandler(async (req, res) => {
  const obligations = await obligationsService.listObligations(req.auth.companyId, req.query);
  res.json(obligations);
});

const scan = asyncHandler(async (req, res) => {
  const created = await alertsService.scanFiscalObligations(req.auth.companyId);
  res.json({ created, totalCreated: created.length });
});

module.exports = { create, update, list, scan };
