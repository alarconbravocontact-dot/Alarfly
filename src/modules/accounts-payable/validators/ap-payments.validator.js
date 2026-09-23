const { z } = require('zod');

const applicationSchema = z.object({
  billId: z.string().min(1),
  amount: z.number().positive(),
});

const recordPaymentSchema = z
  .object({
    vendorId: z.string().min(1),
    treasuryAccountId: z.string().min(1),
    date: z.coerce.date(),
    amount: z.number().positive().optional(),
    paymentMethodId: z.string().optional(),
    // Fase 4 (BCV): opcionales — si vienen los dos, `amount` se ignora y
    // se deriva de la tasa vigente (snapshot histórico, ver
    // ap-payments.service.resolveForeignAmount).
    foreignCurrency: z.string().length(3).optional(),
    foreignAmount: z.number().positive().optional(),
    applications: z.array(applicationSchema).min(1, 'Debes indicar a qué factura(s) se aplica el pago.'),
  })
  .refine((data) => data.amount != null || (data.foreignCurrency && data.foreignAmount != null), {
    message: 'Debes indicar el monto, o un monto en moneda extranjera con su tasa.',
    path: ['amount'],
  });

const listPaymentsQuerySchema = z.object({
  vendorId: z.string().optional(),
});

module.exports = { recordPaymentSchema, listPaymentsQuerySchema };
