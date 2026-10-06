const { z } = require('zod');

const updatePersonalSettingsSchema = z.object({
  payrollExpenseAccountId: z.string().optional(),
  payrollPayableAccountId: z.string().optional(),
  expenseAccountId: z.string().optional(),
  expenseReimbursementPayableAccountId: z.string().optional(),
});

module.exports = { updatePersonalSettingsSchema };
