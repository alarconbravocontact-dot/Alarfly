const { z } = require('zod');

const createPaymentOrderSchema = z.object({
  treasuryAccountId: z.string().min(1),
  glAccountId: z.string().min(1, 'Debes indicar la cuenta contable a debitar.'),
  payeeName: z.string().min(1, 'El beneficiario es obligatorio.'),
  payeeBankName: z.string().optional(),
  payeeAccountNumber: z.string().optional(),
  amount: z.coerce.number().positive('El monto debe ser mayor que cero.'),
  currency: z.string().length(3),
  description: z.string().min(1, 'La descripción es obligatoria.'),
  scheduledDate: z.coerce.date(),
});

const createPaymentOrderForVendorBillsSchema = z.object({
  vendorId: z.string().min(1),
  treasuryAccountId: z.string().min(1),
  scheduledDate: z.coerce.date(),
  description: z.string().min(1, 'La descripción es obligatoria.'),
  currency: z.string().length(3),
  applications: z
    .array(
      z.object({
        apBillId: z.string().min(1),
        amount: z.number().positive(),
      })
    )
    .min(1, 'Debes indicar a qué factura(s) se aplica el pago.'),
});

const decideApprovalSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().optional(),
});

const listPaymentOrdersQuerySchema = z.object({
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED']).optional(),
  treasuryAccountId: z.string().optional(),
});

module.exports = {
  createPaymentOrderSchema,
  createPaymentOrderForVendorBillsSchema,
  decideApprovalSchema,
  listPaymentOrdersQuerySchema,
};
