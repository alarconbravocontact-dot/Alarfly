const { z } = require('zod');

const createBatchSchema = z.object({
  name: z.string().min(1, 'El nombre del lote es obligatorio.'),
  treasuryAccountId: z.string().min(1),
});

const addOrderSchema = z.object({
  paymentOrderId: z.string().min(1),
});

module.exports = { createBatchSchema, addOrderSchema };
