const { z } = require('zod');

const setParentCompanySchema = z.object({
  parentCompanyId: z.string().nullable(),
});

module.exports = { setParentCompanySchema };
