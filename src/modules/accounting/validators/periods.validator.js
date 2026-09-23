const { z } = require('zod');

const createPeriodSchema = z.object({
  name: z.string().min(1, 'El nombre del periodo es obligatorio.'),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

const reopenPeriodSchema = z.object({
  reason: z.string().min(1, 'Debes indicar el motivo para reabrir el periodo.'),
});

module.exports = { createPeriodSchema, reopenPeriodSchema };
