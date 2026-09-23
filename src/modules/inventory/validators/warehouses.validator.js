const { z } = require('zod');

const createWarehouseSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  address: z.string().optional(),
  branchDimensionId: z.string().optional(),
  isDefault: z.boolean().optional(),
});

const updateWarehouseSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const listWarehousesQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

module.exports = { createWarehouseSchema, updateWarehouseSchema, listWarehousesQuerySchema };
