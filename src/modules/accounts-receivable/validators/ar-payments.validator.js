const { z } = require('zod');

const applicationSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
});

const recordPaymentSchema = z
  .object({
    customerId: z.string().min(1),
    treasuryAccountId: z.string().optional(),
    bankTransactionId: z.string().optional(),
    date: z.coerce.date(),
    amount: z.number().positive().optional(),
    applications: z.array(applicationSchema).optional().default([]),
  })
  .refine((data) => Boolean(data.bankTransactionId) || (Boolean(data.treasuryAccountId) && data.amount != null), {
    message: 'Debes indicar un movimiento bancario real (bankTransactionId), o una cuenta de tesorería junto con el monto.',
    path: ['bankTransactionId'],
  });

const applyAdvanceSchema = z.object({
  applications: z.array(applicationSchema).min(1, 'Debes indicar a qué factura(s) se aplica el anticipo.'),
});

const listPaymentsQuerySchema = z.object({
  customerId: z.string().optional(),
});

module.exports = { recordPaymentSchema, applyAdvanceSchema, listPaymentsQuerySchema };
