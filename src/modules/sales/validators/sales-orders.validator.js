const { z } = require('zod');

const orderLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().optional(),
  variantId: z.string().optional(),
  warehouseId: z.string().optional(),
});

const createSalesOrderSchema = z.object({
  customerId: z.string().min(1),
  orderDate: z.coerce.date(),
  notes: z.string().optional(),
  lines: z.array(orderLineSchema).min(1, 'El pedido necesita al menos una línea.'),
});

const cancelSalesOrderSchema = z.object({
  reason: z.string().min(1, 'Cancelar un pedido necesita un motivo.'),
});

const listSalesOrdersQuerySchema = z.object({
  customerId: z.string().optional(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED']).optional(),
});

module.exports = { createSalesOrderSchema, cancelSalesOrderSchema, listSalesOrdersQuerySchema };
