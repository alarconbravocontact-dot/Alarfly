const { z } = require('zod');

const createBudgetSchema = z
  .object({
    name: z.string().min(1, 'El nombre es obligatorio.'),
    fiscalYear: z.coerce.number().int().min(2000).max(2100),
    versionType: z.enum(['ORIGINAL', 'REFORECAST']).optional(),
    previousVersionId: z.string().optional(),
  })
  .refine((data) => data.versionType !== 'REFORECAST' || data.previousVersionId, {
    message: 'Un REFORECAST debe indicar de qué versión parte (previousVersionId).',
    path: ['previousVersionId'],
  });

const listBudgetsQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().optional(),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'APPROVED']).optional(),
});

const upsertBudgetLineSchema = z
  .object({
    accountId: z.string().min(1, 'Debes indicar la cuenta contable (accountId).'),
    fpaDimensionId: z.string().min(1, 'Debes indicar la dimensión (fpaDimensionId).'),
    period: z.coerce.number().int().min(1).max(12),
    amountType: z.enum(['FIXED', 'FORMULA']).default('FIXED'),
    amount: z.coerce.number().optional(),
    formula: z.string().min(1).optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.amountType !== 'FIXED' || data.amount !== undefined, {
    message: 'Una línea de monto fijo necesita un valor en "amount".',
    path: ['amount'],
  })
  .refine((data) => data.amountType !== 'FORMULA' || data.formula, {
    message: 'Una línea basada en fórmula necesita un valor en "formula".',
    path: ['formula'],
  });

module.exports = { createBudgetSchema, listBudgetsQuerySchema, upsertBudgetLineSchema };
