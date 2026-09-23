const { z } = require('zod');

const createVendorSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  taxId: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  paymentTermsDays: z.number().int().positive().optional(),
});

const updateVendorSchema = z.object({
  name: z.string().min(1).optional(),
  taxId: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  paymentTermsDays: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

const listVendorsQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

module.exports = { createVendorSchema, updateVendorSchema, listVendorsQuerySchema };
