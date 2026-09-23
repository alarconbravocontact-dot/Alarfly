const { z } = require('zod');

const parseFileSchema = z.object({
  filename: z.string().min(1),
  contentBase64: z.string().min(1),
});

module.exports = { parseFileSchema };
