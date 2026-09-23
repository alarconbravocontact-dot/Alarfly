import './StatusSeal.css';

const TONE_BY_STATUS = {
  approved: 'positive',
  active: 'positive',
  verified: 'positive',
  paid: 'positive',
  open: 'positive',
  pending: 'warning',
  waiting: 'warning',
  draft: 'warning',
  rejected: 'negative',
  inactive: 'negative',
  closed: 'negative',
  cancelled: 'negative',
  overdue: 'negative',
};

const GLYPH_BY_TONE = {
  positive: '✓',
  warning: '⏵',
  negative: '✕',
};

/**
 * El "Sello de Estado": mismo componente en todos los módulos para
 * comunicar aprobado/pendiente/rechazado (y sus equivalentes), siempre
 * acompañado de texto — nunca solo color o ícono.
 */
export default function StatusSeal({ status, label, tone }) {
  const resolvedTone = tone || TONE_BY_STATUS[status] || 'neutral';
  const glyph = GLYPH_BY_TONE[resolvedTone] || '•';

  return (
    <span className={`ui-seal ui-seal-${resolvedTone}`}>
      <span className="ui-seal-ring" aria-hidden="true">
        {glyph}
      </span>
      <span className="ui-seal-label">{label}</span>
    </span>
  );
}
