const asyncHandler = require('../../../core/utils/asyncHandler');
const settingsService = require('../services/inventory-settings.service');

const getSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.getOrCreateSettings(req.auth.companyId);
  res.json(settings);
});

const updateSettings = asyncHandler(async (req, res) => {
  const settings = await settingsService.updateSettings(req.auth.companyId, req.auth.userId, req.body);
  res.json(settings);
});

module.exports = { getSettings, updateSettings };
