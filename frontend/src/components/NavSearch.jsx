import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fuzzySearch } from '../utils/fuzzyMatch';
import Icon from '../core/ui/Icon';
import './NavSearch.css';

// Rediseño UX/UI (Etapa 1, sección 4 del documento maestro — "búsqueda"
// listada explícitamente en el shell): antes no existía ningún
// mecanismo de búsqueda global. Construir una búsqueda de DATOS de
// negocio (clientes, facturas...) exigiría una API nueva de agregación
// — fuera de lo que autoriza la sección 20 ("no crear APIs nuevas
// solamente para conseguir un efecto visual"). Esto es una búsqueda de
// NAVEGACIÓN: encuentra una pantalla/submódulo por nombre entre las
// que ya están en el menú lateral, 100% del lado del cliente,
// reutilizando `fuzzyMatch.js` (ya construido, usado por
// `EntityAutocomplete`) — cero llamadas nuevas al backend.
export default function NavSearch({ items }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  const results = isOpen ? fuzzySearch(query, items, (item) => `${item.groupLabel || ''} ${item.label}`).slice(0, 8) : [];

  useEffect(() => {
    function onClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    // Atajo global "/" (como muchos ERP/SaaS) para enfocar la búsqueda
    // sin tocar el mouse — se ignora si el foco ya está en un campo de
    // texto, mismo criterio ya usado por el atajo "N" de creación rápida.
    function onKeyDown(e) {
      if (e.key !== '/' || isOpen) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      containerRef.current?.querySelector('input')?.focus();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  function go(item) {
    setQuery('');
    setIsOpen(false);
    navigate(item.to);
  }

  function onKeyDownInput(e) {
    if (e.key === 'Escape') {
      setIsOpen(false);
      e.currentTarget.blur();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      go(results[activeIndex].item);
    }
  }

  return (
    <div className="nav-search" ref={containerRef}>
      <Icon name="search" size={16} />
      <input
        type="text"
        placeholder="Buscar una pantalla… (/)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={onKeyDownInput}
        aria-label="Buscar una pantalla"
      />
      {isOpen && query && (
        <div className="nav-search-results" role="listbox">
          {results.length === 0 && <p className="nav-search-empty">Sin resultados para "{query}".</p>}
          {results.map(({ item }, i) => (
            <button
              key={item.to}
              type="button"
              className={`nav-search-result${i === activeIndex ? ' is-active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(item)}
            >
              <span className="nav-search-result-label">{item.label}</span>
              {item.groupLabel && <span className="nav-search-result-group">{item.groupLabel}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
