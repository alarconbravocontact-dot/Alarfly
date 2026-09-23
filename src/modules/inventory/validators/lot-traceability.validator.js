const { z } = require('zod');

const listLotsQuerySchema = z.object({
  variantId: z.string().optional(),
  expiringBefore: z.coerce.date().optional(),
});

module.exports = { listLotsQuerySchema };
