const { z } = require('zod');

const createDebtSchema = z
  .object({
    type: z.enum(['LOAN', 'CREDIT_LINE']),
    name: z.string().min(1, 'El nombre es obligatorio.'),
    lender: z.string().min(1, 'La entidad prestamista es obligatoria.'),
    principalAmount: z.coerce.number().positive('El monto debe ser mayor que cero.'),
    interestRate: z.coerce.number().min(0, 'La tasa no puede ser negativa.'),
    currency: z.string().length(3),
    startDate: z.coerce.date(),
    termMonths: z.coerce.number().int().positive().optional(),
    installmentCount: z.coerce.number().int().positive().optional(),
    treasuryAccountId: z.string().min(1),
    liabilityAccountId: z.string().min(1),
    interestExpenseAccountId: z.string().min(1),
  })
  .refine((data) => data.type !== 'LOAN' || data.installmentCount, {
    message: 'Los préstamos necesitan indicar el número de cuotas (installmentCount).',
    path: ['installmentCount'],
  });

const amountSchema = z.object({
  amount: z.coerce.number().positive('El monto debe ser mayor que cero.'),
  date: z.coerce.date().optional(),
});

const listDebtsQuerySchema = z.object({
  type: z.enum(['LOAN', 'CREDIT_LINE']).optional(),
  status: z.enum(['ACTIVE', 'PAID_OFF', 'CANCELLED']).optional(),
});

module.exports = { createDebtSchema, amountSchema, listDebtsQuerySchema };
