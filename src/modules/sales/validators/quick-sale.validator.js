const { z } = require('zod');

const quickSaleLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive().optional(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().optional(),
  variantId: z.string().optional(),
  warehouseId: z.string().optional(),
});

const quickSalePaymentSchema = z.object({
  treasuryAccountId: z.string().optional(),
  bankTransactionId: z.string().optional(),
  paymentMethodId: z.string().optional(),
  amount: z.number().positive().optional(),
  foreignCurrency: z.string().length(3).optional(),
  foreignAmount: z.number().positive().optional(),
});

const quickSaleSchema = z.object({
  customerId: z.string().optional(),
  // F17-E3: bug real de severidad alta encontrado con una empresa
  // nueva de verdad — sin este mensaje, enviar la venta sin ninguna
  // jurisdicción fiscal configurada (que es exactamente lo que le pasa
  // a una empresa que nunca configuró Fiscal) mostraba el mensaje
  // crudo de Zod en inglés ("String must contain at least 1
  // character(s)") directamente en la pantalla — viola la regla del
  // proyecto de nunca mostrar un error técnico sin traducir.
  jurisdictionId: z.string().min(1, 'Selecciona una jurisdicción fiscal antes de registrar la venta.'),
  incomeAccountId: z.string().min(1),
  issueDate: z.coerce.date(),
  taxRateId: z.string().optional(),
  withholdingRateId: z.string().optional(),
  lines: z.array(quickSaleLineSchema).min(1, 'La venta necesita al menos una línea.'),
  payment: quickSalePaymentSchema.optional(),
});

module.exports = { quickSaleSchema };
