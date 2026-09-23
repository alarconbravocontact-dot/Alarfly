const { z } = require('zod');

const taxType = z.enum(['VAT', 'WITHHOLDING', 'OTHER']);
const taxApplicability = z.enum(['SALE', 'PURCHASE', 'BOTH']);

const createJurisdictionSchema = z.object({
  code: z.string().min(1, 'El código es obligatorio.'),
  name: z.string().min(1, 'El nombre es obligatorio.'),
});

const createTaxRateSchema = z.object({
  jurisdictionId: z.string().min(1, 'Debes indicar la jurisdicción.'),
  type: taxType,
  code: z.string().min(1, 'El código de la tasa es obligatorio.'),
  name: z.string().min(1, 'El nombre es obligatorio.'),
  rate: z.coerce.number().min(0, 'La tasa no puede ser negativa.'),
  appliesTo: taxApplicability.optional(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date().optional(),
  glAccountId: z.string().optional(),
});

const closeTaxRateSchema = z.object({
  validTo: z.coerce.date(),
});

const listTaxRatesQuerySchema = z.object({
  jurisdictionId: z.string().optional(),
  type: taxType.optional(),
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

const resolveTaxQuerySchema = z.object({
  jurisdictionId: z.string().min(1, 'Debes indicar la jurisdicción.'),
  transactionType: z.enum(['SALE', 'PURCHASE']),
  date: z.coerce.date(),
});

module.exports = {
  createJurisdictionSchema,
  createTaxRateSchema,
  closeTaxRateSchema,
  listTaxRatesQuerySchema,
  resolveTaxQuerySchema,
};
