const { z } = require('zod');

const startCountSchema = z.object({
  warehouseId: z.string().min(1),
});

const submitCountSchema = z.object({
  lines: z
    .array(
      z.object({
        variantId: z.string().min(1),
        countedQuantity: z.number().nonnegative(),
      })
    )
    .min(1),
});

const rejectCountSchema = z.object({
  rejectionReason: z.string().min(1, 'El rechazo necesita un motivo.'),
});

module.exports = { startCountSchema, submitCountSchema, rejectCountSchema };
