const { z } = require('zod');

const dateRangeQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const asOfDateQuerySchema = z.object({
  asOfDate: z.coerce.date().optional().default(() => new Date()),
});

const compareIncomeStatementQuerySchema = z.object({
  fromA: z.coerce.date(),
  toA: z.coerce.date(),
  fromB: z.coerce.date(),
  toB: z.coerce.date(),
});

const compareBalanceSheetQuerySchema = z.object({
  asOfDateA: z.coerce.date(),
  asOfDateB: z.coerce.date(),
});

const transactionsByTypeQuerySchema = z.object({
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

module.exports = {
  dateRangeQuerySchema,
  asOfDateQuerySchema,
  compareIncomeStatementQuerySchema,
  compareBalanceSheetQuerySchema,
  transactionsByTypeQuerySchema,
};
