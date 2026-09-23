const { z } = require('zod');

const updateArApSettingsSchema = z.object({
  receivableGlAccountId: z.string().min(1).optional(),
  payableGlAccountId: z.string().min(1).optional(),
});

module.exports = { updateArApSettingsSchema };
