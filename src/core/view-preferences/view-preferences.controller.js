const asyncHandler = require('../utils/asyncHandler');
const viewPreferencesService = require('./view-preferences.service');

const getPreference = asyncHandler(async (req, res) => {
  res.json(await viewPreferencesService.getPreference(req.auth.userId, req.params.viewKey));
});

const setPreference = asyncHandler(async (req, res) => {
  res.json(await viewPreferencesService.setPreference(req.auth.companyId, req.auth.userId, req.params.viewKey, req.body.mode));
});

module.exports = { getPreference, setPreference };
