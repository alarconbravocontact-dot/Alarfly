const asyncHandler = require('../../../core/utils/asyncHandler');
const timelineService = require('../services/ar-invoice-timeline.service');

const getTimeline = asyncHandler(async (req, res) => {
  const timeline = await timelineService.getInvoiceTimeline(req.auth.companyId, req.params.id);
  res.json(timeline);
});

module.exports = { getTimeline };
