const { z } = require('zod');

const createCreditNoteSchema = z.object({
  invoiceId: z.string().min(1),
  type: z.enum(['CREDIT', 'DEBIT']),
  reason: z.string().min(1, 'El motivo es obligatorio.'),
  amount: z.number().positive(),
  date: z.coerce.date(),
});

const listCreditNotesQuerySchema = z.object({
  customerId: z.string().optional(),
  invoiceId: z.string().optional(),
  type: z.enum(['CREDIT', 'DEBIT']).optional(),
});

module.exports = { createCreditNoteSchema, listCreditNotesQuerySchema };
