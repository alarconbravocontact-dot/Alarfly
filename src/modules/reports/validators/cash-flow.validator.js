const { z } = require('zod');

const cashFlowQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

module.exports = { cashFlowQuerySchema };
