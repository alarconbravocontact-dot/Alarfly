const { z } = require('zod');

const createFiscalTransactionSchema = z.object({
  type: z.enum(['SALE', 'PURCHASE']),
  jurisdictionId: z.string().min(1, 'Debes indicar la jurisdicción.'),
  date: z.coerce.date(),
  counterpartyName: z.string().min(1, 'El nombre de la contraparte es obligatorio.'),
  counterpartyTaxId: z.string().min(1, 'El NIT/RFC de la contraparte es obligatorio.'),
  documentNumber: z.string().optional(),
  description: z.string().optional(),

  taxBase: z.coerce.number().positive('La base gravable debe ser mayor que cero.'),
  taxBaseAccountId: z.string().min(1, 'Debes indicar la cuenta de ingreso/gasto (taxBaseAccountId).'),
  counterpartyAccountId: z.string().min(1, 'Debes indicar la cuenta de la contraparte (counterpartyAccountId).'),

  taxRateId: z.string().optional(),
  taxAccountId: z.string().optional(),
  withholdingRateId: z.string().optional(),
  withholdingAccountId: z.string().optional(),
});

const listFiscalTransactionsQuerySchema = z.object({
  type: z.enum(['SALE', 'PURCHASE']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

module.exports = { createFiscalTransactionSchema, listFiscalTransactionsQuerySchema };
