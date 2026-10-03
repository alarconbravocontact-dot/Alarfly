import { useState } from 'react';
import { Link } from 'react-router-dom';
import { contactApi } from '../../api/contact';
import { ApiError } from '../../api/client';
import Seo from '../../core/ui/Seo';
import LegalLayout from './LegalLayout';
import './ContactPage.css';

const EMPTY_FORM = { name: '', email: '', subject: '', message: '', honeypot: '' };

// Formulario de contacto real (Cierre Web/SEO): no existía ninguno en
// el proyecto (auditado antes de construir). Guarda el mensaje en
// `ContactMessage` (backend) — NO envía un correo real, porque el
// proyecto no tiene ningún servicio de envío de email configurado
// (confirmado por auditoría, documentado también en
// WEB_SEO_PERFORMANCE_FINAL.md) — se le dice esto honestamente al
// usuario en el estado de éxito, en vez de prometer un correo que no
// se manda.
export default function ContactPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  function validate() {
    const errors = {};
    if (form.name.trim().length < 2) errors.name = 'Escribe tu nombre completo.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Escribe un correo válido.';
    if (form.subject.trim().length < 3) errors.subject = 'Cuéntanos brevemente el motivo.';
    if (form.message.trim().length < 10) errors.message = 'El mensaje es muy corto — cuéntanos un poco más.';
    return errors;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setStatus('loading');
    setErrorMessage('');
    try {
      await contactApi.send(form);
      setStatus('success');
      setForm(EMPTY_FORM);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof ApiError ? err.message : 'No se pudo enviar tu mensaje. Intenta de nuevo en un momento.');
    }
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  return (
    <LegalLayout title="Contacto — Alarfly">
      <Seo title="Contacto" description="Escríbenos tus preguntas sobre Alarfly — ventas, soporte o cualquier duda." path="/contacto" />

      <p>
        ¿Tienes una pregunta sobre Alarfly, necesitas ayuda con tu cuenta, o quieres saber más antes de empezar?
        Escríbenos y te respondemos lo antes posible.
      </p>

      {status === 'success' ? (
        <div className="contact-success" role="status">
          <h2>Mensaje recibido</h2>
          <p>
            Gracias por escribirnos — tu mensaje quedó registrado y lo revisaremos pronto. Si necesitas una
            respuesta urgente, también puedes <Link to="/registro">crear tu cuenta gratis</Link> y explorar el
            producto mientras tanto.
          </p>
          <button type="button" className="btn btn-ghost" onClick={() => setStatus('idle')}>
            Enviar otro mensaje
          </button>
        </div>
      ) : (
        <form className="contact-form" onSubmit={handleSubmit} noValidate>
          <label className="contact-field">
            <span>Nombre</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateField('name', e.target.value)}
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? 'contact-error-name' : undefined}
              autoComplete="name"
              required
            />
            {fieldErrors.name && (
              <span className="contact-field-error" id="contact-error-name" role="alert">
                {fieldErrors.name}
              </span>
            )}
          </label>

          <label className="contact-field">
            <span>Correo electrónico</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'contact-error-email' : undefined}
              autoComplete="email"
              required
            />
            {fieldErrors.email && (
              <span className="contact-field-error" id="contact-error-email" role="alert">
                {fieldErrors.email}
              </span>
            )}
          </label>

          <label className="contact-field">
            <span>Asunto</span>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => updateField('subject', e.target.value)}
              aria-invalid={Boolean(fieldErrors.subject)}
              aria-describedby={fieldErrors.subject ? 'contact-error-subject' : undefined}
              required
            />
            {fieldErrors.subject && (
              <span className="contact-field-error" id="contact-error-subject" role="alert">
                {fieldErrors.subject}
              </span>
            )}
          </label>

          <label className="contact-field">
            <span>Mensaje</span>
            <textarea
              rows={6}
              value={form.message}
              onChange={(e) => updateField('message', e.target.value)}
              aria-invalid={Boolean(fieldErrors.message)}
              aria-describedby={fieldErrors.message ? 'contact-error-message' : undefined}
              required
            />
            {fieldErrors.message && (
              <span className="contact-field-error" id="contact-error-message" role="alert">
                {fieldErrors.message}
              </span>
            )}
          </label>

          {/* Honeypot: invisible para una persona real (oculto fuera de
              pantalla, nunca con display:none/visibility:hidden, para que
              un lector de pantalla tampoco se detenga en él gracias a
              aria-hidden + tabIndex=-1) — un bot que rellena cada campo a
              ciegas sí lo completa. */}
          <label className="contact-honeypot" aria-hidden="true">
            <span>No llenar este campo</span>
            <input type="text" tabIndex={-1} autoComplete="off" value={form.honeypot} onChange={(e) => updateField('honeypot', e.target.value)} />
          </label>

          {status === 'error' && (
            <p className="contact-error" role="alert">
              {errorMessage}
            </p>
          )}

          <button type="submit" className="btn btn-primary btn-large" disabled={status === 'loading'}>
            {status === 'loading' ? 'Enviando…' : 'Enviar mensaje'}
          </button>
        </form>
      )}
    </LegalLayout>
  );
}
