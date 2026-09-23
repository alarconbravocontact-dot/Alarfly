const asyncHandler = require('../../../core/utils/asyncHandler');
const arCollectionsService = require('../services/ar-collections.service');

const scan = asyncHandler(async (req, res) => {
  const created = await arCollectionsService.scanOverdueInvoices(req.auth.companyId, req.auth.userId);
  res.json({ alertsCreated: created });
});

module.exports = { scan };
