const { z } = require('zod');

const adjustmentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('RECURRING_EXPENSE'), monthlyAmount: z.coerce.number() }),
  z.object({ type: z.literal('NEW_HIRE'), monthlyCost: z.coerce.number() }),
  z.object({ type: z.literal('SALES_VARIATION'), percentage: z.coerce.number() }),
]);

const simulateScenarioSchema = z.object({
  baselineFrom: z.coerce.date(),
  baselineTo: z.coerce.date(),
  projectionMonths: z.coerce.number().int().min(1).max(60),
  adjustments: z.array(adjustmentSchema).default([]),
  // Cuántas semanas de Previsión de Liquidez proyectar; si no se indica,
  // se calcula a partir de projectionMonths (ver scenarios.service.js).
  weeks: z.coerce.number().int().min(1).max(52).optional(),
});

const saveScenarioSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  description: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()),
  projectedResult: z.record(z.string(), z.unknown()),
});

module.exports = { simulateScenarioSchema, saveScenarioSchema };
