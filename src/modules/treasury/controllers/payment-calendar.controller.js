const asyncHandler = require('../../../core/utils/asyncHandler');
const paymentCalendarService = require('../services/payment-calendar.service');

const getCalendar = asyncHandler(async (req, res) => {
  const weeks = req.query.weeks;
  const calendar = await paymentCalendarService.getPaymentCalendar(req.auth.companyId, { weeks });
  res.json(calendar);
});

module.exports = { getCalendar };
