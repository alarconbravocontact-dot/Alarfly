const { z } = require('zod');

const updateInventorySettingsSchema = z.object({
  defaultValuationMethod: z.enum(['FIFO', 'LIFO', 'WEIGHTED_AVERAGE']).optional(),
  defaultInventoryAssetAccountId: z.string().min(1).optional(),
  defaultCogsExpenseAccountId: z.string().min(1).optional(),
  defaultShrinkageExpenseAccountId: z.string().min(1).optional(),
});

module.exports = { updateInventorySettingsSchema };
