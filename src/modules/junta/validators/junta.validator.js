const { z } = require('zod');

// Solo PDF, imagen o Excel — mismo criterio de "validar antes de aceptar"
// que ya usa Fiscal con sus documentos digitales, pero acá restringido a
// los 3 tipos que pidió el usuario para un reporte de trabajo.
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const topicEnum = z.enum(['INVENTORY', 'ACCOUNTING', 'PROJECTIONS', 'GENERAL']);

const createMessageSchema = z.object({
  message: z.string().min(1, 'Escribe un mensaje.').max(2000, 'El mensaje es demasiado largo.'),
  topic: topicEnum.default('GENERAL'),
  fileName: z.string().min(1, 'El nombre del archivo es obligatorio.'),
  fileMimeType: z.enum(ALLOWED_MIME_TYPES, {
    errorMap: () => ({ message: 'Solo se aceptan archivos PDF, imagen (PNG/JPG/WEBP) o Excel.' }),
  }),
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_FILE_SIZE_BYTES, 'El archivo no puede pesar más de 10 MB.'),
  fileContentBase64: z.string().min(1, 'El contenido del archivo es obligatorio.'),
});

module.exports = { createMessageSchema, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES };
