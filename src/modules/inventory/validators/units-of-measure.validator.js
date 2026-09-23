const { z } = require('zod');

const createUnitOfMeasureSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});

const updateUnitOfMeasureSchema = z.object({
  code: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

const listUnitsOfMeasureQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

module.exports = { createUnitOfMeasureSchema, updateUnitOfMeasureSchema, listUnitsOfMeasureQuerySchema };
