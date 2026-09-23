import { useEffect, useState } from 'react';
import { viewPreferencesApi } from '../../api/view-preferences';
import './ViewSwitcher.css';

const DEFAULT_VIEWS = [
  { mode: 'LIST', label: 'Lista' },
  { mode: 'KANBAN', label: 'Kanban' },
  { mode: 'CALENDAR', label: 'Calendario' },
];

// Selector de vista Lista/Kanban/Calendario, reutilizable por
// cualquier pantalla con una lista de registros: `viewKey` identifica
// la pantalla para recordar la última vista elegida por usuario
// (core/view-preferences, nunca compartida entre usuarios — mismo
// patrón que ExecutiveSummaryCards/panel-preferences). Este componente
// no sabe nada de facturas ni de pagos: solo avisa con `onChange(mode)`
// cuál vista mostrar, la pantalla que lo usa decide cómo renderizar
// cada una.
export default function ViewSwitcher({ viewKey, views = DEFAULT_VIEWS, onChange }) {
  const [mode, setMode] = useState('LIST');

  useEffect(() => {
    let isMounted = true;
    viewPreferencesApi
      .get(viewKey)
      .then((pref) => {
        if (isMounted) {
          setMode(pref.mode);
          onChange?.(pref.mode);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey]);

  function selectMode(next) {
    if (next === mode) return;
    setMode(next);
    onChange?.(next);
    viewPreferencesApi.set(viewKey, next).catch(() => {});
  }

  return (
    <div className="view-switcher" role="tablist" aria-label="Cambiar de vista">
      {views.map((v) => (
        <button
          key={v.mode}
          type="button"
          role="tab"
          aria-selected={mode === v.mode}
          className={`view-switcher-btn${mode === v.mode ? ' is-active' : ''}`}
          onClick={() => selectMode(v.mode)}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
