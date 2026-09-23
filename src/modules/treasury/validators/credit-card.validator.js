const { z } = require('zod');

const importCardStatementSchema = z.object({
  treasuryAccountId: z.string().min(1, 'Debes indicar la tarjeta.'),
  fileName: z.string().optional(),
  fileContent: z.string().min(1, 'El archivo está vacío.'),
});

const listCardTransactionsQuerySchema = z.object({
  treasuryAccountId: z.string().optional(),
  matchStatus: z.enum(['UNMATCHED', 'MATCHED']).optional(),
});

const flagTransactionSchema = z.object({
  hasReceipt: z.boolean().optional().default(false),
  isPolicyViolation: z.boolean().optional().default(false),
});

const matchPettyCashSchema = z.object({
  pettyCashExpenseId: z.string().min(1),
});

module.exports = {
  importCardStatementSchema,
  listCardTransactionsQuerySchema,
  flagTransactionSchema,
  matchPettyCashSchema,
};
