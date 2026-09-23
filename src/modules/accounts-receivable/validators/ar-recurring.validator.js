const { z } = require('zod');

const recurringLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive().optional(),
  unitPrice: z.number().nonnegative(),
});

const createTemplateSchema = z.object({
  customerId: z.string().min(1),
  jurisdictionId: z.string().min(1),
  incomeAccountId: z.string().min(1),
  taxRateId: z.string().optional(),
  withholdingRateId: z.string().optional(),
  linesSnapshot: z.array(recurringLineSchema).min(1, 'La plantilla necesita al menos una línea.'),
});

module.exports = { createTemplateSchema };
