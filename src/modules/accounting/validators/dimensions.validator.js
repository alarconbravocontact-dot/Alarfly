const { z } = require('zod');

const createDimensionSchema = z.object({
  type: z.enum(['COST_CENTER', 'PROJECT', 'BRANCH']),
  code: z.string().min(1, 'El código es obligatorio.'),
  name: z.string().min(1, 'El nombre es obligatorio.'),
});

module.exports = { createDimensionSchema };
