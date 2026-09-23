const { z } = require('zod');

const userRole = z.enum(['ADMIN', 'ACCOUNTANT', 'FINANCE', 'COLLABORATOR']);

const createRuleSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  minAmount: z.coerce.number().min(0),
  maxAmount: z.coerce.number().positive().nullable().optional(),
  levels: z
    .array(
      z.object({
        level: z.coerce.number().int().positive(),
        allowedRoles: z.array(userRole).min(1, 'Cada nivel necesita al menos un rol permitido.'),
      })
    )
    .min(1, 'La regla necesita al menos un nivel de aprobación.'),
});

module.exports = { createRuleSchema };
