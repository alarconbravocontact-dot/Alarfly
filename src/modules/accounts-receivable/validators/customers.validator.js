const { z } = require('zod');

const createCustomerSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.'),
  taxId: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  paymentTermsDays: z.number().int().positive().optional(),
  creditLimit: z.number().nonnegative().optional(),
  maxOverdueDaysAllowed: z.number().int().nonnegative().optional(),
  isForeign: z.boolean().optional(),
  billingCurrency: z.string().length(3).optional(),
});

const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  taxId: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  paymentTermsDays: z.number().int().positive().optional(),
  creditLimit: z.number().nonnegative().nullable().optional(),
  maxOverdueDaysAllowed: z.number().int().nonnegative().nullable().optional(),
  isForeign: z.boolean().optional(),
  billingCurrency: z.string().length(3).nullable().optional(),
  isActive: z.boolean().optional(),
});

const blockCustomerSchema = z.object({
  reason: z.string().min(1, 'El bloqueo necesita un motivo.'),
});

const listCustomersQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

// Asistente de importación: cada fila ya viajó por la pantalla de
// mapeo y validación de tipos del frontend, pero se revalida acá con
// el mismo esquema de "crear uno" — nunca se confía en datos que
// vinieron de un archivo sin pasar otra vez por la validación real.
const importCustomersSchema = z.object({
  rows: z.array(createCustomerSchema).min(1, 'No hay filas para importar.').max(500, 'Como máximo 500 filas por importación.'),
});

module.exports = {
  createCustomerSchema,
  updateCustomerSchema,
  blockCustomerSchema,
  listCustomersQuerySchema,
  importCustomersSchema,
};
