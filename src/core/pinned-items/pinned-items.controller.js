const asyncHandler = require('../utils/asyncHandler');
const pinnedItemsService = require('./pinned-items.service');

const listPinnedItems = asyncHandler(async (req, res) => {
  res.json(await pinnedItemsService.listPinnedItems(req.auth.companyId, req.auth.userId));
});

const pinItem = asyncHandler(async (req, res) => {
  res.status(201).json(await pinnedItemsService.pinItem(req.auth.companyId, req.auth.userId, req.body));
});

const unpinItem = asyncHandler(async (req, res) => {
  await pinnedItemsService.unpinItem(req.auth.companyId, req.auth.userId, req.params.id);
  res.status(204).send();
});

const recordVisit = asyncHandler(async (req, res) => {
  await pinnedItemsService.recordVisit(req.auth.companyId, req.auth.userId, req.body.path);
  res.status(204).send();
});

module.exports = { listPinnedItems, pinItem, unpinItem, recordVisit };
