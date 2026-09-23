import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { helpApi } from '../api/help';
import { ApiError } from '../api/client';
import { moduleKeyForPath } from '../config/moduleTabs';
import './ContextualHelpButton.css';

// Botón de ayuda flotante (Feature Q): muestra artículos relevantes a
// la PANTALLA ACTIVA (detectada por ruta → moduleKey, ver
// `moduleKeyForPath`), no un buscador genérico de toda la
// documentación — nunca se le pide al backend "todos los artículos",
// siempre los del módulo actual.
export default function ContextualHelpButton() {
  const location = useLocation();
  const containerRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [context, setContext] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [askResult, setAskResult] = useState(null);
  const [isAsking, setIsAsking] = useState(false);

  const moduleKey = moduleKeyForPath(location.pathname);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setError('');
    setAskResult(null);
    setQuestionText('');
    helpApi
      .getContext(moduleKey)
      .then(setContext)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar la ayuda.'))
      .finally(() => setIsLoading(false));
    // Solo se vuelve a pedir al abrir el panel o al cambiar de módulo
    // con el panel ya abierto — no en cada clic dentro del panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, moduleKey]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function handleAsk(event) {
    event.preventDefault();
    if (!questionText.trim()) return;
    setIsAsking(true);
    setAskResult(null);
    try {
      const result = await helpApi.ask(moduleKey, questionText.trim());
      setAskResult(result.article);
    } catch {
      setAskResult(undefined); // se interpreta como "no se pudo preguntar", distinto de "sin resultado"
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <div className="contextual-help" ref={containerRef}>
      <button
        type="button"
        className="contextual-help-fab"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Ayuda de esta pantalla"
        aria-expanded={isOpen}
        title="Ayuda de esta pantalla"
      >
        ?
      </button>
      {isOpen && (
        <div className="contextual-help-panel">
          <p className="contextual-help-title">Ayuda de esta pantalla</p>

          {isLoading && <p className="text-muted" style={{ padding: '8px 12px' }}>Cargando…</p>}
          {!isLoading && error && (
            <p className="alert-box alert-box-error" style={{ margin: 8 }}>
              {error}
            </p>
          )}

          {!isLoading && !error && context && (
            <div className="contextual-help-body">
              {context.priorAnswer && (
                <div className="contextual-help-prior">
                  <p className="contextual-help-prior-label">Ya preguntaste algo parecido</p>
                  <p className="contextual-help-prior-question">“{context.priorAnswer.questionText}”</p>
                  <p className="contextual-help-article-title">{context.priorAnswer.article.title}</p>
                  <p className="contextual-help-article-body">{context.priorAnswer.article.body}</p>
                </div>
              )}

              <form className="contextual-help-ask" onSubmit={handleAsk}>
                <label className="field">
                  <span>¿Tienes una pregunta?</span>
                  <div className="contextual-help-ask-row">
                    <input
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      placeholder="Escribe tu pregunta…"
                    />
                    <button type="submit" className="btn btn-small btn-primary" disabled={isAsking || !questionText.trim()}>
                      {isAsking ? '…' : 'Preguntar'}
                    </button>
                  </div>
                </label>
              </form>

              {askResult !== null && askResult !== undefined && (
                <div className="contextual-help-answer">
                  <p className="contextual-help-article-title">{askResult.title}</p>
                  <p className="contextual-help-article-body">{askResult.body}</p>
                </div>
              )}
              {askResult === null && (
                <p className="text-muted contextual-help-no-answer">
                  No encontramos nada relacionado — revisa los artículos de abajo.
                </p>
              )}
              {askResult === undefined && (
                <p className="alert-box alert-box-error" style={{ margin: '8px 0' }}>
                  No se pudo procesar tu pregunta. Intenta de nuevo.
                </p>
              )}

              <p className="contextual-help-section-title">Artículos de esta pantalla</p>
              {context.articles.length === 0 && (
                <p className="text-muted" style={{ padding: '0 12px 8px' }}>
                  Todavía no hay artículos para esta pantalla.
                </p>
              )}
              {context.articles.map((article) => (
                <div key={article.id} className="contextual-help-article">
                  <p className="contextual-help-article-title">{article.title}</p>
                  <p className="contextual-help-article-body">{article.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
