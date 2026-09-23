const { z } = require('zod');

const recurrence = z.enum(['MONTHLY', 'BIMONTHLY', 'ANNUAL']);

const createObligationSchema = z
  .object({
    jurisdictionId: z.string().min(1, 'Debes indicar la jurisdicción.'),
    name: z.string().min(1, 'El nombre es obligatorio.'),
    description: z.string().optional(),
    recurrence,
    dueDayOfMonth: z.coerce.number().int().min(1).max(31),
    dueMonth: z.coerce.number().int().min(1).max(12).optional(),
  })
  .refine((data) => data.recurrence === 'MONTHLY' || data.dueMonth !== undefined, {
    message: 'Las obligaciones bimestrales o anuales necesitan indicar dueMonth.',
    path: ['dueMonth'],
  });

const updateObligationSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  recurrence: recurrence.optional(),
  dueDayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  dueMonth: z.coerce.number().int().min(1).max(12).optional(),
  isActive: z.boolean().optional(),
});

const listObligationsQuerySchema = z.object({
  jurisdictionId: z.string().optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

module.exports = { createObligationSchema, updateObligationSchema, listObligationsQuerySchema };
