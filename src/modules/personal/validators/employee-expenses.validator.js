const { z } = require('zod');

const registerExpenseSchema = z.object({
  employeeId: z.string().min(1, 'Debes indicar el empleado.'),
  expenseDate: z.coerce.date(),
  category: z.string().optional(),
  description: z.string().min(1, 'La descripción es obligatoria.'),
  amount: z.coerce.number().positive('El monto debe ser mayor que cero.'),
  currency: z.string().min(1, 'La moneda es obligatoria.'),
  receiptFileName: z.string().optional(),
  receiptMimeType: z.string().optional(),
  receiptContent: z.string().optional(),
});

const decideExpenseSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().optional(),
});

const reimburseExpenseSchema = z.object({
  treasuryAccountId: z.string().min(1, 'Debes indicar con qué cuenta se reembolsa.'),
});

const listExpensesQuerySchema = z.object({
  employeeId: z.string().optional(),
  status: z.enum(['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'REIMBURSED']).optional(),
});

module.exports = { registerExpenseSchema, decideExpenseSchema, reimburseExpenseSchema, listExpensesQuerySchema };
