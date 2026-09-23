const asyncHandler = require('../utils/asyncHandler');
const arApSettingsService = require('./ar-ap-settings.service');

const getSettings = asyncHandler(async (req, res) => {
  const settings = await arApSettingsService.getOrCreateSettings(req.auth.companyId);
  res.json(settings);
});

const updateSettings = asyncHandler(async (req, res) => {
  const settings = await arApSettingsService.updateSettings(req.auth.companyId, req.auth.userId, req.body);
  res.json(settings);
});

module.exports = { getSettings, updateSettings };
