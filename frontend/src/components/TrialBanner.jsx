import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { accountApi } from '../api/account';
import './TrialBanner.css';

// Fase Landing — Registro Público: aviso real de la prueba de 7 días,
// visible en toda la app (montado una vez en AppLayout, junto al resto
// de piezas transversales como NotificationCenter). Una empresa creada
// antes de que existiera el registro público (por invitación o seed)
// nunca tiene trialEndsAt — el banner simplemente no se muestra, nunca
// inventa una fecha. A propósito NO bloquea ninguna operación cuando
// la prueba vence (todavía no existe a dónde mandar un pago real) —
// solo informa, de forma cada vez más urgente según quedan los días,
// honesto sobre el estado real en vez de fingir una restricción que
// el sistema no puede hacer cumplir todavía.
export default function TrialBanner() {
  const [trialEndsAt, setTrialEndsAt] = useState(undefined); // undefined = cargando

  useEffect(() => {
    let cancelled = false;
    accountApi
      .getCompanyProfile()
      .then((profile) => {
        if (!cancelled) setTrialEndsAt(profile?.trialEndsAt || null);
      })
      .catch(() => {
        if (!cancelled) setTrialEndsAt(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!trialEndsAt) return null;

  const msRemaining = new Date(trialEndsAt).getTime() - Date.now();
  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
  const isExpired = msRemaining <= 0;
  const isUrgent = !isExpired && daysRemaining <= 2;

  const tone = isExpired ? 'alert-box-error' : isUrgent ? 'alert-box-warning' : 'alert-box-success';
  const message = isExpired
    ? 'Tu prueba gratuita de 7 días terminó. Escríbenos para seguir usando Alarfly sin interrupciones.'
    : daysRemaining <= 1
      ? 'Último día de tu prueba gratuita.'
      : `Te quedan ${daysRemaining} días de tu prueba gratuita.`;

  return (
    <div className={`alert-box ${tone} trial-banner`} role="status">
      <span>{message}</span>
      <Link to="/mi-cuenta" className="trial-banner-link">
        {isExpired ? 'Contactar' : 'Ver detalles'}
      </Link>
    </div>
  );
}
