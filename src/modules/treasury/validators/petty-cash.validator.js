const { z } = require('zod');

const createFundSchema = z.object({
  name: z.string().min(1, 'El nombre del fondo es obligatorio.'),
  custodianUserId: z.string().min(1, 'Debes indicar el responsable del fondo.'),
  branchDimensionId: z.string().optional(),
  initialAmount: z.coerce.number().positive('El monto inicial debe ser mayor que cero.'),
  replenishmentThreshold: z.coerce.number().min(0, 'El umbral de reposición no puede ser negativo.'),
  glAccountId: z.string().min(1, 'Debes indicar la cuenta contable de caja chica.'),
  treasuryAccountId: z.string().optional(),
});

const listFundsQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'CLOSED']).optional(),
});

const registerExpenseSchema = z.object({
  fundId: z.string().min(1),
  amount: z.coerce.number().positive('El monto debe ser mayor que cero.'),
  description: z.string().min(1, 'La descripción es obligatoria.'),
  expenseDate: z.coerce.date(),
  category: z.string().optional(),
  receiptFileName: z.string().optional(),
  receiptMimeType: z.string().optional(),
  receiptContent: z.string().optional(),
  expenseGlAccountId: z.string().min(1, 'Debes indicar a qué cuenta de gasto corresponde.'),
});

const decideExpenseSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().optional(),
});

const bulkDecideExpensesSchema = z.object({
  expenseIds: z.array(z.string().min(1)).min(1, 'Selecciona al menos un gasto.'),
  decision: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().optional(),
});

const listExpensesQuerySchema = z.object({
  fundId: z.string().optional(),
  status: z.enum(['PENDING_APPROVAL', 'APPROVED', 'REJECTED']).optional(),
});

const replenishSchema = z.object({
  amount: z.coerce.number().positive('El monto debe ser mayor que cero.'),
  date: z.coerce.date().optional(),
});

module.exports = {
  createFundSchema,
  listFundsQuerySchema,
  registerExpenseSchema,
  decideExpenseSchema,
  bulkDecideExpensesSchema,
  listExpensesQuerySchema,
  replenishSchema,
};
