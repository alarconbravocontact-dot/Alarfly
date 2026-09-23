const { z } = require('zod');

const purchaseOrderLineSchema = z.object({
  variantId: z.string().min(1),
  quantityOrdered: z.number().positive(),
  unitCost: z.number().nonnegative().optional(),
});

const createPurchaseOrderSchema = z.object({
  vendorId: z.string().optional(),
  warehouseId: z.string().min(1),
  orderDate: z.coerce.date(),
  expectedDate: z.coerce.date().optional(),
  notes: z.string().optional(),
  lines: z.array(purchaseOrderLineSchema).min(1),
});

const receiptLineSchema = z.object({
  lineId: z.string().min(1),
  quantityReceived: z.number().positive(),
  unitCost: z.number().nonnegative().optional(),
  lotNumber: z.string().optional(),
  expirationDate: z.coerce.date().optional(),
});

const receivePurchaseOrderSchema = z.object({
  date: z.coerce.date(),
  counterpartyAccountId: z.string().min(1),
  receipts: z.array(receiptLineSchema).min(1),
});

const listPurchaseOrdersQuerySchema = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']).optional(),
  warehouseId: z.string().optional(),
  vendorId: z.string().optional(),
});

module.exports = { createPurchaseOrderSchema, receivePurchaseOrderSchema, listPurchaseOrdersQuerySchema };
