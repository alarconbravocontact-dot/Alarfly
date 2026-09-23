const { z } = require('zod');

const setPreferenceSchema = z.object({
  mode: z.enum(['LIST', 'KANBAN', 'CALENDAR']),
});

module.exports = { setPreferenceSchema };
