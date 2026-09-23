const { z } = require('zod');

const liquidityForecastQuerySchema = z.object({
  weeks: z.coerce.number().int().positive().max(26).optional(),
});

module.exports = { liquidityForecastQuerySchema };
