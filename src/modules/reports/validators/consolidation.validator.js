const { z } = require('zod');

const consolidationQuerySchema = z.object({
  asOfDate: z.coerce.date().optional().default(() => new Date()),
});

module.exports = { consolidationQuerySchema };
