import { useEffect, useMemo, useRef, useState } from 'react';
import { fuzzySearch } from '../../utils/fuzzyMatch';
import { recentlyUsedApi } from '../../api/recently-used';
import './EntityAutocomplete.css';

const MAX_SUGGESTIONS = 30;
const MAX_RECENT = 8;
const RECENCY_BOOST_STEP = 4;

/**
 * Autocompletado con búsqueda difusa, reutilizable sobre cualquier
 * campo que referencie una cuenta contable, cliente o producto (o
 * cualquier otra entidad futura). Prioriza en los resultados lo usado
 * más recientemente por ESTE usuario (vía core/recently-used) sobre el
 * simple orden alfabético. Si la búsqueda no tiene ninguna coincidencia,
 * ofrece crear la entidad nueva sin salir del formulario — pero este
 * componente no sabe cómo crearla: solo avisa con `onCreateNew(term)` y
 * deja que la pantalla que lo usa muestre su propio QuickCreateModal
 * con los campos correctos para ese tipo de entidad.
 *
 * `items`: lista ya cargada por la pantalla (mismo criterio que
 * FilterBuilder/DataTable: sin motor de búsqueda nuevo en el backend).
 */
export default function EntityAutocomplete({
  entityType,
  items,
  getId,
  getLabel,
  getSearchText,
  value,
  onChange,
  onCreateNew,
  createLabel,
  placeholder = 'Buscar…',
  disabled = false,
  required = false,
  flashKey,
}) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const [recentIds, setRecentIds] = useState([]);
  const [isFlashing, setIsFlashing] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const isFirstFlashRender = useRef(true);

  // Innovación pedida explícitamente: al cerrar el modal de creación
  // rápida (QuickCreateModal), el campo que se acaba de autocompletar
  // con la entidad nueva se resalta brevemente — la pantalla que usa
  // este componente solo tiene que cambiar `flashKey` (ej. al id recién
  // creado) cuando quiere disparar el resalte; nunca al montar por
  // primera vez ni al elegir algo del propio desplegable.
  useEffect(() => {
    if (isFirstFlashRender.current) {
      isFirstFlashRender.current = false;
      return undefined;
    }
    if (flashKey == null) return undefined;
    setIsFlashing(true);
    const timer = setTimeout(() => setIsFlashing(false), 1400);
    return () => clearTimeout(timer);
  }, [flashKey]);

  const selectedItem = useMemo(() => items.find((i) => getId(i) === value) || null, [items, value, getId]);

  useEffect(() => {
    recentlyUsedApi
      .list(entityType)
      .then(setRecentIds)
      .catch(() => setRecentIds([]));
  }, [entityType]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  function getBoost(item) {
    const idx = recentIds.indexOf(getId(item));
    return idx === -1 ? 0 : Math.max(0, (MAX_RECENT - idx) * RECENCY_BOOST_STEP);
  }

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      const recentItems = recentIds.map((id) => items.find((it) => getId(it) === id)).filter(Boolean);
      if (recentItems.length > 0) return recentItems.slice(0, MAX_RECENT);
      return items.slice(0, MAX_RECENT);
    }
    return fuzzySearch(trimmed, items, getSearchText, getBoost)
      .slice(0, MAX_SUGGESTIONS)
      .map((s) => s.item);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, items, recentIds]);

  function openDropdown() {
    setIsOpen(true);
    setHighlightIndex(0);
  }

  async function selectItem(item) {
    const id = getId(item);
    onChange(id, item);
    setQuery('');
    setIsOpen(false);
    try {
      await recentlyUsedApi.record(entityType, id);
      setRecentIds((prev) => [id, ...prev.filter((rid) => rid !== id)].slice(0, MAX_RECENT));
    } catch {
      // no crítico: la próxima carga vuelve a resolver el orden real
    }
  }

  function handleKeyDown(event) {
    if (!isOpen) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (results.length > 0) {
        selectItem(results[highlightIndex] || results[0]);
      } else if (onCreateNew && query.trim()) {
        setIsOpen(false);
        onCreateNew(query.trim());
      }
    } else if (event.key === 'Escape') {
      setIsOpen(false);
      setQuery('');
      inputRef.current?.blur();
    }
  }

  const displayValue = isOpen ? query : selectedItem ? getLabel(selectedItem) : '';

  return (
    <div className={`ui-entity-autocomplete${isFlashing ? ' ui-entity-autocomplete-flash' : ''}`} ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        value={displayValue}
        placeholder={placeholder}
        disabled={disabled}
        required={required && !value}
        onFocus={openDropdown}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          setHighlightIndex(0);
        }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {isOpen && (
        <div className="ui-entity-autocomplete-menu">
          {results.length === 0 && (
            <div className="ui-entity-autocomplete-empty">
              {query.trim() && onCreateNew ? (
                <button
                  type="button"
                  className="ui-entity-autocomplete-create is-highlighted"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setIsOpen(false);
                    onCreateNew(query.trim());
                  }}
                >
                  + Crear &ldquo;{query.trim()}&rdquo; como {createLabel}
                </button>
              ) : (
                <span>Sin resultados.</span>
              )}
            </div>
          )}
          {results.map((item, index) => (
            <button
              type="button"
              key={getId(item)}
              className={`ui-entity-autocomplete-option${index === highlightIndex ? ' is-highlighted' : ''}${
                getId(item) === value ? ' is-selected' : ''
              }`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlightIndex(index)}
              onClick={() => selectItem(item)}
            >
              <span>{getLabel(item)}</span>
              {!query.trim() && recentIds.includes(getId(item)) && (
                <span className="ui-entity-autocomplete-recent-tag">reciente</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
