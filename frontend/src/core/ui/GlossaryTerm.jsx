import { useState } from 'react';
import { glossaryApi } from '../../api/glossary';
import { formatCurrency } from '../../utils/format';
import './GlossaryTerm.css';

function formatLiveValue(liveValue) {
  if (liveValue.value === null || liveValue.value === undefined) return '—';
  if (liveValue.unit === 'meses') return `${liveValue.value} meses`;
  return formatCurrency(liveValue.value, liveValue.currency);
}

// Envuelve cualquier palabra o frase con jerga financiera para
// mostrarle al usuario su definición en lenguaje simple al hacer clic
// (no solo al pasar el mouse, mismo criterio que HelpTooltip para que
// funcione igual en pantallas táctiles). La innovación pedida
// explícitamente: si el término tiene un valor real calculable para
// ESTA empresa (ej. EBITDA, Total por cobrar), se muestra junto a la
// definición genérica — nunca inventado, siempre reutilizando el
// mismo servicio que ya calcula ese número en otra pantalla.
export default function GlossaryTerm({ termKey, children }) {
  const [isOpen, setIsOpen] = useState(false);
  // undefined = todavía no se pidió; null = se pidió y no existe; objeto = encontrado.
  const [term, setTerm] = useState(undefined);
  const [liveValue, setLiveValue] = useState(null);
  const [isLoadingLive, setIsLoadingLive] = useState(false);

  async function handleToggle() {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (!nextOpen || term !== undefined) return;

    const terms = await glossaryApi.listTerms().catch(() => []);
    const found = terms.find((t) => t.key === termKey) ?? null;
    setTerm(found);

    if (found?.hasLiveValue) {
      setIsLoadingLive(true);
      glossaryApi
        .getLiveValue(termKey)
        .then(setLiveValue)
        .catch(() => setLiveValue(null))
        .finally(() => setIsLoadingLive(false));
    }
  }

  return (
    <span className="glossary-term">
      <button
        type="button"
        className="glossary-term-trigger"
        onClick={handleToggle}
        onBlur={() => setIsOpen(false)}
        aria-expanded={isOpen}
      >
        {children}
      </button>
      {isOpen && (
        <span className="glossary-term-popover" role="tooltip">
          {term === undefined && <span className="text-muted">Cargando…</span>}
          {term === null && <span className="text-muted">No se encontró la definición.</span>}
          {term && <span>{term.definition}</span>}
          {term?.formula && (
            <span className="glossary-term-formula text-muted" title={term.sourceRef}>
              Cómo se calcula: {term.formula}
            </span>
          )}
          {term?.hasLiveValue && (
            <span className="glossary-term-live">
              {isLoadingLive && 'Calculando tu valor actual…'}
              {!isLoadingLive && liveValue && (
                <>
                  {liveValue.label}: <strong>{formatLiveValue(liveValue)}</strong>
                </>
              )}
              {!isLoadingLive && !liveValue && 'No se pudo calcular tu valor actual.'}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
