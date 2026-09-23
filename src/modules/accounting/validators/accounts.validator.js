const { z } = require('zod');

const accountType = z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']);
const normalBalance = z.enum(['DEBIT', 'CREDIT']);
const financialStatementSection = z.enum([
  'ACTIVO_CORRIENTE',
  'ACTIVO_NO_CORRIENTE',
  'PASIVO_CORRIENTE',
  'PASIVO_NO_CORRIENTE',
  'PATRIMONIO',
  'INGRESO_OPERACIONAL',
  'INGRESO_NO_OPERACIONAL',
  'COSTO_VENTAS',
  'GASTO_OPERACIONAL',
  'GASTO_NO_OPERACIONAL',
]);

const createAccountSchema = z.object({
  code: z.string().min(1, 'El código es obligatorio.'),
  name: z.string().min(1, 'El nombre es obligatorio.'),
  type: accountType,
  normalBalance,
  parentId: z.string().nullable().optional(),
  isPostable: z.boolean().optional(),
  description: z.string().optional(),
  financialStatementSection: financialStatementSection.nullable().optional(),
});

const updateAccountSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  financialStatementSection: financialStatementSection.nullable().optional(),
  isForeignCurrency: z.boolean().optional(),
  foreignCurrencyCode: z.string().length(3).nullable().optional(),
  isIntercompany: z.boolean().optional(),
  intercompanyCompanyId: z.string().nullable().optional(),
});

const listAccountsQuerySchema = z.object({
  type: accountType.optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

module.exports = { createAccountSchema, updateAccountSchema, listAccountsQuerySchema };
