const { z } = require('zod');

const invoiceLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive().optional(),
  unitPrice: z.number().nonnegative(),
  // Fase 3 (Ventas), punto 10: opcionales — una línea sin `variantId`
  // sigue siendo solo texto, como siempre.
  discount: z.number().nonnegative().optional(),
  variantId: z.string().optional(),
  warehouseId: z.string().optional(),
  salesOrderLineId: z.string().optional(),
});

const createInvoiceSchema = z.object({
  customerId: z.string().min(1),
  jurisdictionId: z.string().min(1),
  incomeAccountId: z.string().min(1),
  issueDate: z.coerce.date(),
  documentNumber: z.string().optional(),
  taxRateId: z.string().optional(),
  withholdingRateId: z.string().optional(),
  salesOrderId: z.string().optional(),
  lines: z.array(invoiceLineSchema).min(1, 'La factura necesita al menos una línea.'),
});

const listInvoicesQuerySchema = z.object({
  customerId: z.string().optional(),
  status: z.enum(['OPEN', 'PARTIALLY_PAID', 'PAID', 'CANCELLED']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const salesTrendQuerySchema = z.object({
  months: z.coerce.number().int().positive().max(24).optional(),
});

module.exports = { createInvoiceSchema, listInvoicesQuerySchema, salesTrendQuerySchema };
