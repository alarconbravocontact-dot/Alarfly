const { z } = require('zod');
const { ALERT_TYPES } = require('./alert-type');

const listNotificationsQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'ACKNOWLEDGED']).optional(),
  type: z.enum(ALERT_TYPES).optional(),
});

module.exports = { listNotificationsQuerySchema };
