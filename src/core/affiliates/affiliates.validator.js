const { z } = require('zod');

const registerAffiliateSchema = z.object({
  name: z.string().min(1, 'Tu nombre es obligatorio.'),
  email: z.string().email('Debe ser un correo válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
  phone: z.string().max(40).optional(),
});

const loginAffiliateSchema = z.object({
  email: z.string().email('Debe ser un correo válido.'),
  password: z.string().min(1, 'La contraseña es obligatoria.'),
});

const AFFILIATE_COMMISSION_STATUSES = ['PENDING', 'APPROVED', 'PAYABLE', 'PAID', 'CANCELLED'];

const transitionCommissionSchema = z.object({
  status: z.enum(AFFILIATE_COMMISSION_STATUSES),
  note: z.string().max(500).optional(),
});

const AFFILIATE_STATUSES = ['ACTIVE', 'SUSPENDED'];

const setAffiliateStatusSchema = z.object({
  status: z.enum(AFFILIATE_STATUSES),
});

const updateSettingsSchema = z.object({
  rateType: z.enum(['FLAT', 'PERCENTAGE']).optional(),
  rateValue: z.coerce.number().positive().optional(),
  referenceAmount: z.coerce.number().positive().optional(),
  currency: z.string().min(1).max(10).optional(),
});

module.exports = {
  registerAffiliateSchema,
  loginAffiliateSchema,
  transitionCommissionSchema,
  setAffiliateStatusSchema,
  updateSettingsSchema,
};
