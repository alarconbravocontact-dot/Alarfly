const { z } = require('zod');

const variantSchema = z.object({
  sku: z.string().min(1),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

const unitConversionSchema = z.object({
  unitOfMeasureId: z.string().min(1),
  conversionFactor: z.number().positive(),
});

const createProductSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  valuationMethod: z.enum(['FIFO', 'LIFO', 'WEIGHTED_AVERAGE']).optional(),
  baseUnitOfMeasureId: z.string().min(1),
  inventoryAssetAccountId: z.string().optional(),
  cogsExpenseAccountId: z.string().optional(),
  isService: z.boolean().optional(),
  trackLots: z.boolean().optional(),
  trackExpiration: z.boolean().optional(),
  minStock: z.number().nonnegative().optional(),
  maxStock: z.number().nonnegative().optional(),
  preferredVendorId: z.string().optional(),
  variants: z.array(variantSchema).optional(),
  unitConversions: z.array(unitConversionSchema).optional(),
});

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  valuationMethod: z.enum(['FIFO', 'LIFO', 'WEIGHTED_AVERAGE']).optional(),
  inventoryAssetAccountId: z.string().optional(),
  cogsExpenseAccountId: z.string().optional(),
  isService: z.boolean().optional(),
  trackLots: z.boolean().optional(),
  trackExpiration: z.boolean().optional(),
  minStock: z.number().nonnegative().optional(),
  maxStock: z.number().nonnegative().optional(),
  preferredVendorId: z.string().optional(),
  isActive: z.boolean().optional(),
});

const addVariantSchema = z.object({
  sku: z.string().min(1),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

const listProductsQuerySchema = z.object({
  isActive: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  categoryId: z.string().optional(),
});

module.exports = { createProductSchema, updateProductSchema, addVariantSchema, listProductsQuerySchema };
