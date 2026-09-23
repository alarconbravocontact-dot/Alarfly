const { z } = require('zod');

// Fase 4 (punto 29 — integración mínima de devoluciones a proveedor):
// `physicalReturn` es opcional — la mayoría de las notas no tienen
// devolución física real (ej. un descuento del proveedor). Cuando sí
// la hay, genera una salida real de inventario (VENDOR_RETURN_EXIT).
const physicalReturnSchema = z.object({
  productVariantId: z.string().min(1),
  warehouseId: z.string().min(1),
  quantity: z.number().positive(),
});

const createCreditNoteSchema = z.object({
  billId: z.string().min(1),
  type: z.enum(['CREDIT', 'DEBIT']),
  reason: z.string().min(1, 'El motivo es obligatorio.'),
  amount: z.number().positive(),
  date: z.coerce.date(),
  physicalReturn: physicalReturnSchema.optional(),
});

const listCreditNotesQuerySchema = z.object({
  vendorId: z.string().optional(),
  billId: z.string().optional(),
  type: z.enum(['CREDIT', 'DEBIT']).optional(),
});

module.exports = { createCreditNoteSchema, listCreditNotesQuerySchema };
