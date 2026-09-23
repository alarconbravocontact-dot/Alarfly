const asyncHandler = require('../utils/asyncHandler');
const savedViewsService = require('./saved-views.service');

const listSavedViews = asyncHandler(async (req, res) => {
  res.json(await savedViewsService.listSavedViews(req.auth.companyId, req.query.tableKey));
});

const createSavedView = asyncHandler(async (req, res) => {
  res.status(201).json(await savedViewsService.createSavedView(req.auth.companyId, req.auth.userId, req.body));
});

const getSavedView = asyncHandler(async (req, res) => {
  res.json(await savedViewsService.getSavedView(req.auth.companyId, req.params.id));
});

const deleteSavedView = asyncHandler(async (req, res) => {
  await savedViewsService.deleteSavedView(req.auth.companyId, req.auth.userId, req.auth.role, req.params.id);
  res.status(204).send();
});

module.exports = { listSavedViews, createSavedView, getSavedView, deleteSavedView };
