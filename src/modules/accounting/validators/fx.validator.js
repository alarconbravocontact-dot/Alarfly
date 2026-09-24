const { z } = require('zod');

const recordRateSchema = z.object({
  currency: z.string().min(3, 'Usa el código ISO de la moneda, ej: EUR.').max(3),
  rate: z.coerce.number().positive('La tasa debe ser mayor que cero.'),
  date: z.coerce.date(),
  // Fase 6: BCV es el default porque es la fuente de referencia
  // principal del sistema — MANUAL es la excepción explícita (ej. una
  // tasa paralela o de acuerdo puntual), nunca al revés.
  source: z.enum(['BCV', 'MANUAL']).optional().default('BCV'),
});

const revalueSchema = z.object({
  asOfDate: z.coerce.date().optional().default(() => new Date()),
});

module.exports = { recordRateSchema, revalueSchema };
