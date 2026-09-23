const { z } = require('zod');

const billLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive().optional(),
  unitPrice: z.number().nonnegative(),
  // Fase 4 (Compras): opcionales — una línea sin `variantId` sigue
  // siendo solo texto, como siempre (mismo criterio que AR/Ventas).
  discount: z.number().nonnegative().optional(),
  variantId: z.string().optional(),
  warehouseId: z.string().optional(),
  purchaseOrderLineId: z.string().optional(),
});

const createBillSchema = z.object({
  vendorId: z.string().min(1),
  jurisdictionId: z.string().min(1),
  expenseAccountId: z.string().min(1),
  issueDate: z.coerce.date(),
  documentNumber: z.string().optional(),
  taxRateId: z.string().optional(),
  withholdingRateId: z.string().optional(),
  lines: z.array(billLineSchema).min(1, 'La factura necesita al menos una línea.'),
});

const listBillsQuerySchema = z.object({
  vendorId: z.string().optional(),
  status: z.enum(['OPEN', 'PARTIALLY_PAID', 'PAID', 'CANCELLED']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

module.exports = { createBillSchema, listBillsQuerySchema };
