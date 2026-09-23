const { z } = require('zod');

const deliveryLineSchema = z.object({
  orderLineId: z.string().min(1),
  quantity: z.number().positive(),
});

const createSalesDeliverySchema = z.object({
  orderId: z.string().min(1),
  deliveryDate: z.coerce.date(),
  responsibleUserId: z.string().optional(),
  lines: z.array(deliveryLineSchema).min(1, 'La entrega necesita al menos una línea.'),
});

const cancelSalesDeliverySchema = z.object({
  reason: z.string().min(1, 'Cancelar una entrega necesita un motivo.'),
});

const listSalesDeliveriesQuerySchema = z.object({
  orderId: z.string().optional(),
  customerId: z.string().optional(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']).optional(),
});

module.exports = { createSalesDeliverySchema, cancelSalesDeliverySchema, listSalesDeliveriesQuerySchema };
