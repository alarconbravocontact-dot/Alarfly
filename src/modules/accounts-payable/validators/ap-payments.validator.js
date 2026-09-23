const { z } = require('zod');

const applicationSchema = z.object({
  billId: z.string().min(1),
  amount: z.number().positive(),
});

const recordPaymentSchema = z.object({
  vendorId: z.string().min(1),
  treasuryAccountId: z.string().min(1),
  date: z.coerce.date(),
  amount: z.number().positive(),
  applications: z.array(applicationSchema).min(1, 'Debes indicar a qué factura(s) se aplica el pago.'),
});

const listPaymentsQuerySchema = z.object({
  vendorId: z.string().optional(),
});

module.exports = { recordPaymentSchema, listPaymentsQuerySchema };
