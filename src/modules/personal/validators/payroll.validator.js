const { z } = require('zod');

const createPayrollSchema = z
  .object({
    label: z.string().min(1, 'Ponle un nombre al período (ej. "Enero 2026").'),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    paymentDate: z.coerce.date(),
    currency: z.string().min(1, 'La moneda es obligatoria.'),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'La fecha de fin no puede ser anterior a la de inicio.',
    path: ['endDate'],
  });

const calculatePayrollSchema = z.object({
  employeeIds: z.array(z.string().min(1)).min(1, 'Selecciona al menos un empleado.'),
});

const breakdownLineSchema = z.object({
  label: z.string().min(1, 'Cada concepto necesita una etiqueta.'),
  amount: z.coerce.number().positive('El monto de cada concepto debe ser mayor que cero.'),
});

const updatePayrollItemSchema = z.object({
  incomeBreakdown: z.array(breakdownLineSchema).optional(),
  deductionBreakdown: z.array(breakdownLineSchema).optional(),
});

const payPayrollSchema = z.object({
  treasuryAccountId: z.string().min(1, 'Debes indicar con qué cuenta se paga.'),
});

const listPayrollsQuerySchema = z.object({
  status: z.enum(['DRAFT', 'CALCULATED', 'REVIEWED', 'APPROVED', 'PAID']).optional(),
});

module.exports = {
  createPayrollSchema,
  calculatePayrollSchema,
  updatePayrollItemSchema,
  payPayrollSchema,
  listPayrollsQuerySchema,
};
