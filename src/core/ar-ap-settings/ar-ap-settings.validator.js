const { z } = require('zod');

const updateArApSettingsSchema = z.object({
  receivableGlAccountId: z.string().min(1).optional(),
  payableGlAccountId: z.string().min(1).optional(),
  // Fase 3 (Ventas), punto 22: "Consumidor Final" opcional para Venta
  // Rápida — nullable para poder quitarlo sin tener que borrar el resto
  // de la configuración.
  defaultCustomerId: z.string().min(1).nullable().optional(),
});

module.exports = { updateArApSettingsSchema };
