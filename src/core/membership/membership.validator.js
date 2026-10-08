const { z } = require('zod');
const { MANUAL_PAYMENT_METHODS } = require('./membership.rules');

// Comprobante de pago: solo PDF o imagen (una captura de pantalla de la
// transferencia/Zelle/Pago Móvil es el caso real) — mismo límite de
// tamaño ya usado por Junta para adjuntos.
const ALLOWED_PROOF_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'];
// 3 MB, no 10 — el archivo viaja como base64 dentro del body JSON
// (+33% de peso) y `express.json` en este proyecto tiene un límite
// global de 5mb (app.js, para los archivos bancarios importados); un
// límite más alto produciría un 413 crudo en vez del error claro que
// pide esta pantalla.
const MAX_PROOF_SIZE_BYTES = 3 * 1024 * 1024;

const submitPaymentSchema = z.object({
  method: z.enum(MANUAL_PAYMENT_METHODS, {
    errorMap: () => ({ message: 'Elige un método de pago válido.' }),
  }),
  referenceNote: z.string().max(500).optional(),
  // El frontend genera esta clave una sola vez por intento de checkout
  // y la reenvía igual si el usuario hace doble clic o recarga — el
  // servidor nunca confía en el precio/plan que venga del body, solo en
  // esto para no duplicar el envío.
  idempotencyKey: z.string().min(8).max(100),
  proofFileName: z.string().min(1, 'Adjunta el comprobante del pago.'),
  proofMimeType: z.enum(ALLOWED_PROOF_MIME_TYPES, {
    errorMap: () => ({ message: 'Solo se aceptan comprobantes en PDF, PNG, JPG o WEBP.' }),
  }),
  proofSizeBytes: z.number().int().positive().max(MAX_PROOF_SIZE_BYTES, 'El comprobante no puede pesar más de 10 MB.'),
  proofContentBase64: z.string().min(1, 'El contenido del comprobante es obligatorio.'),
});

const decidePaymentSchema = z.object({
  approve: z.boolean(),
  note: z.string().max(500).optional(),
});

module.exports = {
  submitPaymentSchema,
  decidePaymentSchema,
  ALLOWED_PROOF_MIME_TYPES,
  MAX_PROOF_SIZE_BYTES,
};
