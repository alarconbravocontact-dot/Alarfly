const { z } = require('zod');

const uploadDocumentSchema = z.object({
  fiscalTransactionId: z.string().min(1, 'Debes indicar la transacción fiscal (fiscalTransactionId).'),
  fileType: z.enum(['PDF', 'XML', 'OTHER']),
  fileName: z.string().min(1, 'El nombre del archivo es obligatorio.'),
  mimeType: z.string().min(1, 'El tipo de archivo (mimeType) es obligatorio.'),
  content: z.string().min(1, 'El contenido del archivo (en base64) es obligatorio.'),
});

const searchDocumentsQuerySchema = z.object({
  counterparty: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  fileType: z.enum(['PDF', 'XML', 'OTHER']).optional(),
});

module.exports = { uploadDocumentSchema, searchDocumentsQuerySchema };
