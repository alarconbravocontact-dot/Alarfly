const { z } = require('zod');

const createUnitOfMeasureSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
});

module.exports = { createUnitOfMeasureSchema };
