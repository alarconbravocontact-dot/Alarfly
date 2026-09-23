const asyncHandler = require('../utils/asyncHandler');
const recentlyUsedService = require('./recently-used.service');

const recordUsage = asyncHandler(async (req, res) => {
  await recentlyUsedService.recordUsage(req.auth.companyId, req.auth.userId, req.params.entityType, req.body.entityId);
  res.status(204).send();
});

const listRecent = asyncHandler(async (req, res) => {
  res.json(await recentlyUsedService.listRecent(req.auth.userId, req.params.entityType));
});

module.exports = { recordUsage, listRecent };
