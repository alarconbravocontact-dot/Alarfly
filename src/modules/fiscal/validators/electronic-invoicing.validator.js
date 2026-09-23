const { z } = require('zod');

const generateDocumentSchema = z.object({
  provider: z.enum(['MOCK']).optional(),
});

const cancelDocumentSchema = z.object({
  reason: z.string().min(1, 'El motivo de anulación es obligatorio.'),
});

const listDocumentsQuerySchema = z.object({
  status: z.enum(['GENERATED', 'REJECTED', 'CANCELLED']).optional(),
});

module.exports = { generateDocumentSchema, cancelDocumentSchema, listDocumentsQuerySchema };
