const { z } = require('zod');

const updateSettingsSchema = z.object({
  requiresApprovalForManualEntries: z.boolean().optional(),
  entryNumberPrefix: z.string().nullable().optional(),
  fxGainLossAccountId: z.string().nullable().optional(),
});

module.exports = { updateSettingsSchema };
