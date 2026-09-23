const { z } = require('zod');

const recordUsageSchema = z.object({
  entityId: z.string().min(1),
});

module.exports = { recordUsageSchema };
