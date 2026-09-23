const { z } = require('zod');

const exportQuerySchema = z.object({
  format: z.enum(['pdf', 'excel', 'csv']),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  asOfDate: z.coerce.date().optional().default(() => new Date()),
});

const createScheduledReportSchema = z.object({
  reportType: z.string().min(1),
  parameters: z.record(z.string(), z.unknown()).optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  recipients: z.array(z.string().email()).min(1, 'Debes indicar al menos un destinatario.'),
});

const updateScheduledReportSchema = z.object({
  isActive: z.boolean().optional(),
  frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
  recipients: z.array(z.string().email()).min(1).optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
});

module.exports = { exportQuerySchema, createScheduledReportSchema, updateScheduledReportSchema };
