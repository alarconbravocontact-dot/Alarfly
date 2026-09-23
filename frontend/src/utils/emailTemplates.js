// Plantillas de mensaje predefinidas para "Enviar por correo" (Feature
// W) — agrupadas por tipo de documento, para que el asunto y el
// cuerpo se auto-rellenen según qué se está enviando. Agregar una
// plantilla nueva es una entrada más en este archivo, mismo patrón
// que el catálogo de ayuda contextual o el glosario.
export const EMAIL_TEMPLATES = {
  'ar-invoice': [
    {
      key: 'payment-reminder',
      label: 'Recordatorio de pago',
      buildSubject: (ctx) => `Recordatorio: Factura N.º ${ctx.invoiceNumber} pendiente de pago`,
      buildBody: (ctx) =>
        `Hola ${ctx.customerName},\n\nTe escribimos para recordarte que la factura N.º ${ctx.invoiceNumber} por ${ctx.amount} sigue pendiente de pago (venció el ${ctx.dueDate}).\n\nSi ya la pagaste, puedes ignorar este mensaje.\n\nSaludos.`,
    },
    {
      key: 'invoice-copy',
      label: 'Envío de copia de factura',
      buildSubject: (ctx) => `Copia de tu factura N.º ${ctx.invoiceNumber}`,
      buildBody: (ctx) => `Hola ${ctx.customerName},\n\nTe compartimos la copia de la factura N.º ${ctx.invoiceNumber} por ${ctx.amount}.\n\nSaludos.`,
    },
  ],
  report: [
    {
      key: 'monthly-report',
      label: 'Envío de reporte mensual',
      buildSubject: (ctx) => `${ctx.reportName} — ${ctx.period}`,
      buildBody: (ctx) => `Hola,\n\nTe comparto el ${ctx.reportName} correspondiente a ${ctx.period}. Adjunto la exportación en el formato que prefieras (PDF/Excel/CSV) desde el mismo menú.\n\nSaludos.`,
    },
  ],
};

// Arma la URL mailto: — nunca envía el correo directamente (el
// proyecto no tiene servidor de correo saliente configurado, ver
// CLAUDE.md): abre el cliente de correo real del propio usuario con
// el borrador ya prellenado, y es el usuario quien decide enviarlo.
export function buildMailtoUrl({ to = '', subject = '', body = '' }) {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body);
  const query = params.toString();
  return `mailto:${to}${query ? `?${query}` : ''}`;
}
