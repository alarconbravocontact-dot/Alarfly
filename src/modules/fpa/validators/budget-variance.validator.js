const { z } = require('zod');

const updateFpaSettingsSchema = z.object({
  varianceThresholdPercentage: z.coerce.number().min(0).max(1000),
});

const submitJustificationSchema = z.object({
  comment: z.string().min(1, 'El comentario/justificación es obligatorio.'),
});

module.exports = { updateFpaSettingsSchema, submitJustificationSchema };
