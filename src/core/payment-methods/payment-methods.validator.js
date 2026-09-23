const { z } = require('zod');

const createPaymentMethodSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});

const updatePaymentMethodSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

const listPaymentMethodsQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

module.exports = { createPaymentMethodSchema, updatePaymentMethodSchema, listPaymentMethodsQuerySchema };
