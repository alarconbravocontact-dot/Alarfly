const { z } = require('zod');

const createEntrySchema = z.object({
  variantId: z.string().min(1),
  warehouseId: z.string().min(1),
  type: z.enum(['PURCHASE_ENTRY', 'PRODUCTION_ENTRY']).optional(),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
  date: z.coerce.date(),
  counterpartyAccountId: z.string().min(1),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  lotNumber: z.string().optional(),
  expirationDate: z.coerce.date().optional(),
  notes: z.string().optional(),
});

const createExitSchema = z.object({
  variantId: z.string().min(1),
  warehouseId: z.string().min(1),
  // Fase 4: VENDOR_RETURN_EXIT — devolución física de mercancía a un
  // proveedor (ver accounts-payable/services/ap-credit-notes.service).
  type: z.enum(['SALE_EXIT', 'CONSUMPTION_EXIT', 'VENDOR_RETURN_EXIT']).optional(),
  quantity: z.number().positive(),
  date: z.coerce.date(),
  referenceType: z.string().optional(),
  referenceId: z.string().optional(),
  notes: z.string().optional(),
});

const createAdjustmentSchema = z.object({
  variantId: z.string().min(1),
  warehouseId: z.string().min(1),
  direction: z.enum(['INCREASE', 'DECREASE']),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative().optional(),
  reason: z.string().min(1, 'Todo ajuste necesita un motivo.'),
  date: z.coerce.date(),
}).refine((data) => data.direction === 'DECREASE' || data.unitCost !== undefined, {
  message: 'Un incremento de inventario necesita indicar el costo unitario.',
  path: ['unitCost'],
});

const listMovementsQuerySchema = z.object({
  variantId: z.string().optional(),
  warehouseId: z.string().optional(),
  type: z
    .enum([
      'PURCHASE_ENTRY',
      'PRODUCTION_ENTRY',
      'SALE_EXIT',
      'CONSUMPTION_EXIT',
      'TRANSFER_OUT',
      'TRANSFER_IN',
      'ADJUSTMENT_INCREASE',
      'ADJUSTMENT_DECREASE',
      'PHYSICAL_COUNT_ADJUSTMENT',
      'VENDOR_RETURN_EXIT',
    ])
    .optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

module.exports = { createEntrySchema, createExitSchema, createAdjustmentSchema, listMovementsQuerySchema };
