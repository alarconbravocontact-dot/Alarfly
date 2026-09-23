const { z } = require('zod');

const listTemplatesQuerySchema = z.object({
  targetKey: z.string().min(1),
});

const createTemplateSchema = z.object({
  targetKey: z.string().min(1),
  name: z.string().min(1, 'El nombre de la plantilla es obligatorio.').max(80, 'El nombre es demasiado largo.'),
  columnMapping: z.record(z.string(), z.string()),
});

module.exports = { listTemplatesQuerySchema, createTemplateSchema };
