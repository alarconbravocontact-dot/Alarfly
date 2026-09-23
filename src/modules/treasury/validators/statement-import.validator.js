const { z } = require('zod');

// El archivo se manda como texto plano en el body (no multipart/form-data
// todavía): el cliente lee el archivo y envía su contenido como string.
const importStatementSchema = z.object({
  treasuryAccountId: z.string().min(1, 'Debes indicar la cuenta de tesorería.'),
  source: z.enum(['CSV', 'OFX', 'MT940']),
  fileName: z.string().optional(),
  fileContent: z.string().min(1, 'El archivo está vacío.'),
});

const listBankTransactionsQuerySchema = z.object({
  treasuryAccountId: z.string().optional(),
  status: z.enum(['UNMATCHED', 'MATCHED', 'IGNORED']).optional(),
});

module.exports = { importStatementSchema, listBankTransactionsQuerySchema };
