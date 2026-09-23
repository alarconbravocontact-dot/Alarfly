const asyncHandler = require('../utils/asyncHandler');
const panelPreferencesService = require('./panel-preferences.service');

const getPreference = asyncHandler(async (req, res) => {
  res.json(await panelPreferencesService.getPreference(req.auth.userId, req.params.panelKey));
});

const setPreference = asyncHandler(async (req, res) => {
  res.json(
    await panelPreferencesService.setPreference(req.auth.companyId, req.auth.userId, req.params.panelKey, req.body.isCollapsed)
  );
});

module.exports = { getPreference, setPreference };
