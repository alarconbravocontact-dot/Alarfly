const { z } = require('zod');

const createMetricSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  unit: z.string().optional(),
  description: z.string().optional(),
});

const updateMetricSchema = z.object({
  name: z.string().min(1).optional(),
  unit: z.string().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

const listMetricsQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

const addEntrySchema = z.object({
  date: z.coerce.date(),
  value: z.coerce.number(),
  note: z.string().optional(),
});

const dateRangeQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

module.exports = {
  createMetricSchema,
  updateMetricSchema,
  listMetricsQuerySchema,
  addEntrySchema,
  dateRangeQuerySchema,
};
