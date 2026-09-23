import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from '../core/ui/Icon';
import './QuickCreateFab.css';

const ACTIONS = {
  invoice: { key: 'invoice', label: 'Nueva factura', hint: 'Registrar una venta a un cliente', path: '/cuentas/facturas-venta' },
  expense: { key: 'expense', label: 'Nuevo gasto', hint: 'Registrar un gasto de caja chica', path: '/tesoreria/caja-chica' },
  customer: { key: 'customer', label: 'Nuevo cliente', hint: 'Agregar un cliente al catálogo', path: '/cuentas/clientes' },
};

// La primera opción sugerida cambia según dónde está el usuario: en la
// pantalla de Clientes, lo más probable es que quiera agregar otro
// cliente; en Tesorería, lo más probable es que quiera registrar un
// gasto. En cualquier otra pantalla, "Nueva factura" queda primero por
// ser la acción más usada en general.
function suggestedOrder(pathname) {
  if (pathname.startsWith('/cuentas/clientes')) return [ACTIONS.customer, ACTIONS.invoice, ACTIONS.expense];
  if (pathname.startsWith('/tesoreria')) return [ACTIONS.expense, ACTIONS.invoice, ACTIONS.customer];
  return [ACTIONS.invoice, ACTIONS.expense, ACTIONS.customer];
}

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

export default function QuickCreateFab() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const firstItemRef = useRef(null);

  // Mismo criterio de permisos que ya usan las 3 pantallas de destino
  // (Clientes, Facturas de venta, Caja Chica): solo Administrador y
  // Colaborador pueden crear ahí, así que el botón ni aparece para los
  // demás roles — no tendría ninguna acción real que ofrecerles.
  const canCreate = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';

  useEffect(() => {
    if (isOpen) firstItemRef.current?.focus();
  }, [isOpen]);

  // Atajo de teclado global "N": abre el mismo menú sin usar el mouse.
  // Se ignora mientras se está escribiendo en un campo (para no
  // interrumpir a alguien tipeando la letra "n" en un formulario).
  useEffect(() => {
    if (!canCreate) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        return;
      }
      if (event.key.toLowerCase() !== 'n' || event.ctrlKey || event.metaKey || event.altKey) return;
      const active = document.activeElement;
      if (active && (EDITABLE_TAGS.has(active.tagName) || active.isContentEditable)) return;
      event.preventDefault();
      setIsOpen(true);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canCreate]);

  // Cerrar al hacer clic fuera del botón/menú.
  useEffect(() => {
    if (!isOpen) return undefined;
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  if (!canCreate) return null;

  function handleSelect(action) {
    setIsOpen(false);
    // El estado de navegación le avisa a la pantalla de destino que
    // debe abrir su formulario de creación sola, sin que el usuario
    // tenga que buscar el botón "+ Nuevo…" otra vez.
    navigate(action.path, { state: { autoOpenCreate: true } });
  }

  const items = suggestedOrder(location.pathname);

  return (
    <div className="quick-create-fab" ref={containerRef}>
      {isOpen && (
        <ul className="quick-create-menu" role="menu">
          {items.map((action, index) => (
            <li key={action.key}>
              <button
                type="button"
                role="menuitem"
                ref={index === 0 ? firstItemRef : undefined}
                className={`quick-create-menu-item${index === 0 ? ' is-suggested' : ''}`}
                onClick={() => handleSelect(action)}
              >
                <span className="quick-create-menu-item-label">{action.label}</span>
                <span className="quick-create-menu-item-hint">{action.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className={`quick-create-button${isOpen ? ' is-open' : ''}`}
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Cerrar menú de creación rápida' : 'Crear (atajo: tecla N)'}
        title="Crear (atajo: tecla N)"
      >
        <Icon name={isOpen ? 'close' : 'plus'} size={24} />
      </button>
    </div>
  );
}
