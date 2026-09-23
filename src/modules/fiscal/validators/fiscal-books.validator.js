const { z } = require('zod');

const dateRangeQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

module.exports = { dateRangeQuerySchema };
