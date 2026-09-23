const { z } = require('zod');

const recordRateSchema = z.object({
  currency: z.string().min(3, 'Usa el código ISO de la moneda, ej: EUR.').max(3),
  rate: z.coerce.number().positive('La tasa debe ser mayor que cero.'),
  date: z.coerce.date(),
});

const revalueSchema = z.object({
  asOfDate: z.coerce.date().optional().default(() => new Date()),
});

module.exports = { recordRateSchema, revalueSchema };
