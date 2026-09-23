const { z } = require('zod');

const pinItemSchema = z.object({
  path: z.string().min(1).max(500),
  label: z.string().min(1).max(200),
});

const recordVisitSchema = z.object({
  path: z.string().min(1).max(500),
});

module.exports = { pinItemSchema, recordVisitSchema };
