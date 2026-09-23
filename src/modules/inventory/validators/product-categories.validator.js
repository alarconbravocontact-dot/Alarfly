const { z } = require('zod');

const createCategorySchema = z.object({
  name: z.string().min(1),
  defaultValuationMethod: z.enum(['FIFO', 'LIFO', 'WEIGHTED_AVERAGE']).optional(),
});

module.exports = { createCategorySchema };
