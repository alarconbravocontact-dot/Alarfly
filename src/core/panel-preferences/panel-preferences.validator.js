const { z } = require('zod');

const setPreferenceSchema = z.object({
  isCollapsed: z.boolean(),
});

module.exports = { setPreferenceSchema };
