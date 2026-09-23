const { z } = require('zod');

// Mismo formato que core/utils/conditionEvaluator.js, con "contains"
// agregado (el evaluador del frontend lo necesita para filtros de
// texto tipo "Cliente contiene…"; el backend no valida el resultado
// de la condición, solo la forma, así que no hace falta duplicar el
// operador ahí).
const conditionLeafSchema = z.object({
  field: z.string().min(1),
  op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'exists', 'not_exists']),
  value: z.any().optional(),
});

const conditionTreeSchema = z.union([
  z.object({ all: z.array(conditionLeafSchema).min(1) }),
  z.object({ any: z.array(conditionLeafSchema).min(1) }),
]);

const createSavedViewSchema = z.object({
  tableKey: z.string().min(1),
  name: z.string().min(1, 'El nombre de la vista es obligatorio.').max(80, 'El nombre es demasiado largo.'),
  conditionTree: conditionTreeSchema,
});

const listSavedViewsQuerySchema = z.object({
  tableKey: z.string().min(1),
});

module.exports = { createSavedViewSchema, listSavedViewsQuerySchema };
