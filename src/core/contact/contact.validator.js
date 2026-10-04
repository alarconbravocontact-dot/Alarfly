const { z } = require('zod');

// `honeypot`: campo oculto que el formulario real nunca llena (un
// humano no lo ve) — si llega con contenido, es casi siempre un bot
// rellenando todos los campos del formulario a ciegas. Protección
// básica, sin servicio externo (reCAPTCHA, etc. no están integrados
// en el proyecto y no se inventa uno nuevo para esto). A propósito
// acepta CUALQUIER texto acá (nunca lo rechaza en la validación): si
// un honeypot lleno disparara un error 400 visible, le revelaría al
// bot que fue detectado — la decisión de descartar en silencio vive
// en `contact.service.createContactMessage`, después de pasar la
// validación de forma.
// Sección 5 del Prompt 2 ("Sugerencias/Feedback"): se extendió este
// mismo formulario con una categoría en vez de crear un mecanismo
// aparte (ver el modelo `ContactMessage.category`). GENERAL por
// defecto para no romper ningún envío existente que no mande el campo.
const CONTACT_CATEGORIES = ['GENERAL', 'SUGGESTION', 'COMMENT', 'IMPROVEMENT', 'BUG_REPORT'];

const createContactMessageSchema = z.object({
  name: z.string().trim().min(2, 'Escribe tu nombre completo.').max(150),
  email: z.string().trim().email('Escribe un correo válido.').max(200),
  subject: z.string().trim().min(3, 'Cuéntanos brevemente el motivo.').max(200),
  message: z.string().trim().min(10, 'El mensaje es muy corto.').max(5000),
  category: z.enum(CONTACT_CATEGORIES).optional().default('GENERAL'),
  honeypot: z.string().max(500).optional(),
});

module.exports = { createContactMessageSchema };
