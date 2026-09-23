const { z } = require('zod');

const agingQuerySchema = z.object({
  asOfDate: z.coerce.date().optional().default(() => new Date()),
});

module.exports = { agingQuerySchema };
