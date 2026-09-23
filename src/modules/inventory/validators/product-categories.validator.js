const { z } = require('zod');

const createCategorySchema = z.object({
  name: z.string().min(1),
  defaultValuationMethod: z.enum(['FIFO', 'LIFO', 'WEIGHTED_AVERAGE']).optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  defaultValuationMethod: z.enum(['FIFO', 'LIFO', 'WEIGHTED_AVERAGE']).nullable().optional(),
  isActive: z.boolean().optional(),
});

const listCategoriesQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

module.exports = { createCategorySchema, updateCategorySchema, listCategoriesQuerySchema };
