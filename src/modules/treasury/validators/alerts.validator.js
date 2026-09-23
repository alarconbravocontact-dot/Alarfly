const { z } = require('zod');
const { ALERT_TYPES } = require('../../../core/alerts/alert-type');

// El motor de alertas es compartido (ver core/alerts): el tipo incluye
// tanto los tipos propios de Tesorería como los que agregan otros
// módulos (ej. FISCAL_OBLIGATION_DUE, del módulo Fiscal). La lista
// vive en core/alerts/alert-type.js para no volver a desincronizarse.
const alertType = z.enum(ALERT_TYPES);

const createAlertRuleSchema = z.object({
  type: alertType,
  name: z.string().min(1, 'El nombre es obligatorio.'),
  parameters: z.record(z.string(), z.any()).default({}),
});

const listAlertsQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'ACKNOWLEDGED']).optional(),
  type: alertType.optional(),
});

module.exports = { createAlertRuleSchema, listAlertsQuerySchema };
