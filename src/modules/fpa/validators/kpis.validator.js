const { z } = require('zod');

const createKpiDefinitionSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  description: z.string().optional(),
  formula: z.string().min(1, 'La fórmula es obligatoria.'),
});

const dateRangeQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

const compareKpiQuerySchema = z.object({
  fromA: z.coerce.date(),
  toA: z.coerce.date(),
  fromB: z.coerce.date(),
  toB: z.coerce.date(),
});

module.exports = { createKpiDefinitionSchema, dateRangeQuerySchema, compareKpiQuerySchema };
