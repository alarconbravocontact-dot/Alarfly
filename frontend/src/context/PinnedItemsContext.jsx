import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { pinnedItemsApi } from '../api/pinned-items';
import { useAuth } from './AuthContext';

const PinnedItemsContext = createContext(null);

// Reportes y vistas filtradas anclados al menú lateral (Feature K).
// La lista real vive en el servidor, ya ordenada por frecuencia de uso
// real reciente (core/pinned-items) — este contexto solo la carga una
// vez, expone pin/unpin, y registra cada visita a una ruta que YA está
// anclada (nunca a rutas sin anclar, para no generar tráfico inútil)
// para que esa frecuencia sea real, no una foto fija del momento en
// que se ancló.
export function PinnedItemsProvider({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const [items, setItems] = useState([]);

  const refresh = useCallback(() => {
    if (!user) return Promise.resolve();
    return pinnedItemsApi
      .list()
      .then(setItems)
      .catch(() => setItems([]));
  }, [user]);

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    refresh();
  }, [user, refresh]);

  // Registra la visita solo si la ruta actual coincide con un ítem ya
  // anclado — evita mandar una petición en cada navegación de la app.
  useEffect(() => {
    if (!user) return;
    const currentPath = location.pathname + location.search;
    if (!items.some((item) => item.path === currentPath)) return;
    pinnedItemsApi
      .recordVisit(currentPath)
      .then(() => refresh())
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, user]);

  const isPinned = useCallback((path) => items.some((item) => item.path === path), [items]);

  const pin = useCallback(
    async (path, label) => {
      await pinnedItemsApi.pin(path, label);
      await refresh();
    },
    [refresh]
  );

  const unpin = useCallback(
    async (id) => {
      await pinnedItemsApi.unpin(id);
      await refresh();
    },
    [refresh]
  );

  const value = useMemo(() => ({ items, isPinned, pin, unpin, refresh }), [items, isPinned, pin, unpin, refresh]);

  return <PinnedItemsContext.Provider value={value}>{children}</PinnedItemsContext.Provider>;
}

export function usePinnedItems() {
  const context = useContext(PinnedItemsContext);
  if (!context) {
    throw new Error('usePinnedItems debe usarse dentro de <PinnedItemsProvider>.');
  }
  return context;
}
