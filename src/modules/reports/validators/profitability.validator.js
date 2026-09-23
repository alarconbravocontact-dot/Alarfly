const { z } = require('zod');

const profitabilityQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

module.exports = { profitabilityQuerySchema };
