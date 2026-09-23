const { z } = require('zod');

const columnConfigSchema = z.object({
  columnKey: z.string().min(1),
  isVisible: z.boolean(),
  width: z.number().int().positive().max(2000).nullable().optional(),
  order: z.number().int(),
});

const savePreferencesSchema = z.object({
  columns: z.array(columnConfigSchema).min(1),
});

// Mismo criterio que export.rules.js (Reportes): título + columnas +
// filas ya aplanadas, este endpoint no sabe nada de facturas, clientes
// ni ninguna otra entidad — solo arma el archivo.
const exportTableSchema = z.object({
  title: z.string().min(1).max(80),
  columns: z.array(z.object({ key: z.string().min(1), label: z.string().min(1) })).min(1),
  rows: z.array(z.record(z.string(), z.any())),
  format: z.enum(['pdf', 'excel', 'csv']).default('excel'),
});

module.exports = { savePreferencesSchema, exportTableSchema };
