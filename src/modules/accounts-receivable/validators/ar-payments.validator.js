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
    paymentMethodId: z.string().optional(),
    // Fase 3 (punto 24, BCV): opcionales — si vienen los dos, `amount`
    // se ignora y se deriva de la tasa vigente (snapshot histórico,
    // ver ar-payments.service.resolveForeignAmount).
    foreignCurrency: z.string().length(3).optional(),
    foreignAmount: z.number().positive().optional(),
    applications: z.array(applicationSchema).optional().default([]),
    applyFullyToInvoiceId: z.string().optional(),
  })
  .refine(
    (data) =>
      Boolean(data.bankTransactionId) ||
      (Boolean(data.treasuryAccountId) && (data.amount != null || (data.foreignCurrency && data.foreignAmount != null))),
    {
      message: 'Debes indicar un movimiento bancario real (bankTransactionId), o una cuenta de tesorería junto con el monto (o un monto en moneda extranjera con su tasa).',
      path: ['bankTransactionId'],
    }
  );

const applyAdvanceSchema = z.object({
  applications: z.array(applicationSchema).min(1, 'Debes indicar a qué factura(s) se aplica el anticipo.'),
});

const listPaymentsQuerySchema = z.object({
  customerId: z.string().optional(),
});

module.exports = { recordPaymentSchema, applyAdvanceSchema, listPaymentsQuerySchema };
