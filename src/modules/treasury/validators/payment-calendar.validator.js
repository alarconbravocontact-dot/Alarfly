const { z } = require('zod');

const paymentCalendarQuerySchema = z.object({
  weeks: z.coerce.number().int().positive().max(26).optional(),
});

module.exports = { paymentCalendarQuerySchema };
