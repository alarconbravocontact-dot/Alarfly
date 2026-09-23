const { z } = require('zod');

const createRuleSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  description: z.string().optional(),
  condition: z.record(z.string(), z.unknown()),
  severity: z.enum(['WARNING', 'BLOCKING']).optional(),
});

const updateRuleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  condition: z.record(z.string(), z.unknown()).optional(),
  severity: z.enum(['WARNING', 'BLOCKING']).optional(),
  isActive: z.boolean().optional(),
});

const listRulesQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

module.exports = { createRuleSchema, updateRuleSchema, listRulesQuerySchema };
