const { z } = require('zod');

const transferLineSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().positive(),
});

const createTransferSchema = z.object({
  fromWarehouseId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  date: z.coerce.date(),
  lines: z.array(transferLineSchema).min(1),
});

module.exports = { createTransferSchema };
