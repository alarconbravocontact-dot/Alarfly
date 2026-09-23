const { z } = require('zod');

const startReconciliationSchema = z.object({
  treasuryAccountId: z.string().min(1),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  statementStartingBalance: z.coerce.number(),
  statementEndingBalance: z.coerce.number(),
});

const manualMatchSchema = z.object({
  bankTransactionId: z.string().min(1),
  journalEntryLineId: z.string().min(1),
});

const matchWithNewEntrySchema = z.object({
  bankTransactionId: z.string().min(1),
  offsetAccountId: z.string().min(1, 'Debes indicar la cuenta contable del otro lado del asiento.'),
  description: z.string().optional(),
});

module.exports = { startReconciliationSchema, manualMatchSchema, matchWithNewEntrySchema };
