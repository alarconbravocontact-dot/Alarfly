const { z } = require('zod');

const lineSchema = z.object({
  accountId: z.string().min(1, 'La línea debe indicar una cuenta.'),
  debit: z.coerce.number().min(0).optional().default(0),
  credit: z.coerce.number().min(0).optional().default(0),
  description: z.string().optional(),
  dimensionIds: z.array(z.string()).optional(),
  // Opcional: si el movimiento fue originalmente en otra moneda, se
  // guarda el monto original y la tasa usada (debit/credit arriba
  // siempre van en la moneda base de la empresa).
  foreignCurrency: z.string().length(3).optional(),
  foreignDebit: z.coerce.number().min(0).optional(),
  foreignCredit: z.coerce.number().min(0).optional(),
  exchangeRate: z.coerce.number().positive().optional(),
});

const createEntrySchema = z.object({
  date: z.coerce.date(),
  description: z.string().min(1, 'La descripción es obligatoria.'),
  lines: z.array(lineSchema).min(2, 'Un asiento necesita al menos dos líneas.'),
});

const reverseEntrySchema = z.object({
  date: z.coerce.date().optional(),
  description: z.string().optional(),
});

const listEntriesQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED']).optional(),
  periodId: z.string().optional(),
});

module.exports = { createEntrySchema, reverseEntrySchema, listEntriesQuerySchema };
