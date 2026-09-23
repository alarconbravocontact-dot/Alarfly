const { z } = require('zod');

const fpaDimensionType = z.enum(['DEPARTMENT', 'BUSINESS_LINE', 'COST_CENTER', 'PRODUCT', 'CLIENT', 'OTHER']);

const createFpaDimensionSchema = z.object({
  type: fpaDimensionType,
  name: z.string().min(1, 'El nombre es obligatorio.'),
  parentId: z.string().optional(),
});

const updateFpaDimensionSchema = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  parentId: z.string().nullable().optional(),
});

const listFpaDimensionsQuerySchema = z.object({
  type: fpaDimensionType.optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

const tagJournalEntryLineSchema = z.object({
  lineId: z.string().min(1, 'Debes indicar la línea de asiento (lineId).'),
  fpaDimensionId: z.string().min(1, 'Debes indicar la dimensión (fpaDimensionId).'),
});

module.exports = {
  createFpaDimensionSchema,
  updateFpaDimensionSchema,
  listFpaDimensionsQuerySchema,
  tagJournalEntryLineSchema,
};
