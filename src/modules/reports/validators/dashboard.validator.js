const { z } = require('zod');

const dashboardQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  asOfDate: z.coerce.date().optional().default(() => new Date()),
});

const setWidgetPreferenceSchema = z.object({
  isVisible: z.boolean().optional(),
  order: z.number().int().optional(),
});

module.exports = { dashboardQuerySchema, setWidgetPreferenceSchema };
