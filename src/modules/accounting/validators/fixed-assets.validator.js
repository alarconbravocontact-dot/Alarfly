const { z } = require('zod');

const depreciationMethod = z.enum(['STRAIGHT_LINE', 'DECLINING_BALANCE', 'UNITS_OF_PRODUCTION']);

const createFixedAssetSchema = z.object({
  code: z.string().min(1, 'El código es obligatorio.'),
  name: z.string().min(1, 'El nombre es obligatorio.'),
  description: z.string().optional(),
  purchaseDate: z.coerce.date(),
  purchaseValue: z.coerce.number().positive('El valor de compra debe ser mayor que cero.'),
  salvageValue: z.coerce.number().min(0).optional().default(0),
  usefulLifeMonths: z.coerce.number().int().positive('La vida útil debe ser en meses, mayor que cero.'),
  depreciationMethod,
  totalUnitsOfProduction: z.coerce.number().int().positive().optional(),
  assetAccountId: z.string().min(1),
  depreciationExpenseAccountId: z.string().min(1),
  accumulatedDepreciationAccountId: z.string().min(1),
});

const runDepreciationSchema = z.object({
  asOfDate: z.coerce.date().optional().default(() => new Date()),
  unitsByAssetId: z.record(z.string(), z.coerce.number().positive()).optional().default({}),
});

const disposeSchema = z.object({
  disposedAt: z.coerce.date().optional(),
});

module.exports = { createFixedAssetSchema, runDepreciationSchema, disposeSchema };
