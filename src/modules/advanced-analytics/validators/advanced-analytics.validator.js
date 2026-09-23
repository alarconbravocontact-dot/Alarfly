const { z } = require('zod');

const ANALYSIS_TYPES = [
  'VERTICAL',
  'HORIZONTAL',
  'FINANCIAL_RATIOS',
  'CASH_FLOW',
  'BREAK_EVEN',
  'CVU',
  'WORKING_CAPITAL',
  'PROFITABILITY_SEGMENT',
  'BUDGET_VS_ACTUAL',
  'DUPONT',
  'TREND_ANALYSIS',
  'WHAT_IF_SCENARIO',
  'INVESTMENT_EVALUATION',
  'FINANCIAL_RISK_LEVERAGE',
  'BENCHMARKING',
  'PREDICTIVE_FORECAST',
];

const runAnalysisSchema = z.object({
  analysisType: z.enum(ANALYSIS_TYPES),
  // La forma de "parameters" depende de cada tipo de análisis (fechas,
  // presupuesto elegido, escenario, flujos de inversión) — se valida
  // adentro de cada handler, no acá, para no duplicar 16 schemas
  // distintos por algo que ya se valida donde se usa.
  parameters: z.record(z.string(), z.unknown()).default({}),
});

const upsertAutomationConfigSchema = z.object({
  isEnabled: z.boolean(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional().nullable(),
  defaultParameters: z.record(z.string(), z.unknown()).optional(),
  alertCondition: z.record(z.string(), z.unknown()).optional().nullable(),
});

const analysisTypeParamSchema = z.object({ analysisType: z.enum(ANALYSIS_TYPES) });

const setCostClassificationSchema = z.object({
  costBehavior: z.enum(['FIXED', 'VARIABLE']),
});

const upsertBenchmarkSchema = z.object({
  label: z.string().min(1),
  industryValue: z.coerce.number(),
  unit: z.string().optional().nullable(),
});

const metricKeyParamSchema = z.object({ metricKey: z.string().min(1) });

const exportReportQuerySchema = z.object({
  format: z.enum(['pdf', 'excel']),
});

const listReportsQuerySchema = z.object({
  analysisType: z.enum(ANALYSIS_TYPES).optional(),
  triggerSource: z.enum(['AUTOMATIC', 'MANUAL']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

module.exports = {
  ANALYSIS_TYPES,
  runAnalysisSchema,
  upsertAutomationConfigSchema,
  analysisTypeParamSchema,
  setCostClassificationSchema,
  upsertBenchmarkSchema,
  metricKeyParamSchema,
  listReportsQuerySchema,
  exportReportQuerySchema,
};
