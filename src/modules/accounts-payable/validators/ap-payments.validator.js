const { z } = require('zod');

const applicationSchema = z.object({
  billId: z.string().min(1),
  amount: z.number().positive(),
});

const recordPaymentSchema = z
  .object({
    vendorId: z.string().min(1),
    treasuryAccountId: z.string().optional(),
    // Fase 6 (sección 24, espejo de AR): pago ligado a un movimiento
    // bancario real ya importado — el monto y la cuenta se derivan de
    // ESE movimiento, no de un número escrito a mano.
    bankTransactionId: z.string().optional(),
    date: z.coerce.date(),
    amount: z.number().positive().optional(),
    paymentMethodId: z.string().optional(),
    // Fase 4 (BCV): opcionales — si vienen los dos, `amount` se ignora y
    // se deriva de la tasa vigente (snapshot histórico, ver
    // fxService.resolveForeignAmountSnapshot).
    foreignCurrency: z.string().length(3).optional(),
    foreignAmount: z.number().positive().optional(),
    // Fase 6 (sección 19-21): número de confirmación de Pago Móvil/
    // Zelle/Binance/transferencia cuando el pago se registra directo
    // (sin bankTransactionId).
    reference: z.string().max(200).optional(),
    applications: z.array(applicationSchema).min(1, 'Debes indicar a qué factura(s) se aplica el pago.'),
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

const listPaymentsQuerySchema = z.object({
  vendorId: z.string().optional(),
});

module.exports = { recordPaymentSchema, listPaymentsQuerySchema };
