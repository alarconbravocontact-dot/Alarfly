const asyncHandler = require('../../../core/utils/asyncHandler');
const settingsService = require('../services/settings.service');

const get = asyncHandler(async (req, res) => {
  const settings = await settingsService.getSettings(req.auth.companyId);
  res.json(settings);
});

const update = asyncHandler(async (req, res) => {
  const settings = await settingsService.updateSettings(req.auth.companyId, req.auth.userId, req.body);
  res.json(settings);
});

module.exports = { get, update };
