const { z } = require('zod');

const bomComponentSchema = z.object({
  componentVariantId: z.string().min(1),
  quantity: z.number().positive(),
});

const createBomSchema = z.object({
  parentVariantId: z.string().min(1),
  components: z.array(bomComponentSchema).min(1),
});

module.exports = { createBomSchema };
