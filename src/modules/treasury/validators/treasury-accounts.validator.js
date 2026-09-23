const { z } = require('zod');

const treasuryAccountType = z.enum(['BANK_ACCOUNT', 'CREDIT_CARD']);

const createTreasuryAccountSchema = z
  .object({
    type: treasuryAccountType,
    name: z.string().min(1, 'El nombre es obligatorio.'),
    currency: z.string().length(3, 'Usa el código ISO de la moneda, ej: USD.'),
    bankName: z.string().optional(),
    accountNumber: z.string().optional(),
    creditLimit: z.coerce.number().positive().optional(),
    glAccountId: z.string().min(1, 'Debes indicar la cuenta contable asociada.'),
    branchDimensionId: z.string().optional(),
  })
  .refine((data) => data.type !== 'CREDIT_CARD' || data.creditLimit !== undefined, {
    message: 'Las tarjetas de crédito necesitan un límite (creditLimit).',
    path: ['creditLimit'],
  });

const updateTreasuryAccountSchema = z.object({
  name: z.string().min(1).optional(),
  bankName: z.string().nullable().optional(),
  accountNumber: z.string().nullable().optional(),
  creditLimit: z.coerce.number().positive().nullable().optional(),
  lowBalanceThreshold: z.coerce.number().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
  branchDimensionId: z.string().nullable().optional(),
});

const listTreasuryAccountsQuerySchema = z.object({
  type: treasuryAccountType.optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

const cashPositionQuerySchema = z.object({
  asOfDate: z.coerce.date().optional().default(() => new Date()),
});

module.exports = {
  createTreasuryAccountSchema,
  updateTreasuryAccountSchema,
  listTreasuryAccountsQuerySchema,
  cashPositionQuerySchema,
};
