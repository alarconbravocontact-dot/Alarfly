import { useEffect, useState } from 'react';
import { accountApi } from '../../api/account';
import { getShortcutRanges } from '../../utils/dateRangeShortcuts';
import './DateRangeSelector.css';

// Selector de rango de fechas con atajos (Hoy, Esta semana, Este mes,
// Trimestre actual, Año fiscal actual, Año pasado) más rango
// personalizado — genérico y reutilizable, no sabe nada de facturas ni
// de ningún otro dato de negocio: solo avisa con `onChange({from,to})`.
// El atajo de año fiscal respeta `Company.fiscalYearStartMonth`
// (Mi Cuenta > Perfil de la empresa), pedido una sola vez al montar.
export default function DateRangeSelector({ value, onChange, initialKey = 'this-month' }) {
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(1);
  const [selectedKey, setSelectedKey] = useState(initialKey);
  const [showCustom, setShowCustom] = useState(initialKey === 'custom');

  useEffect(() => {
    accountApi
      .getCompanyProfile()
      .then((company) => setFiscalYearStartMonth(company.fiscalYearStartMonth || 1))
      .catch(() => {});
  }, []);

  const shortcuts = getShortcutRanges(new Date(), fiscalYearStartMonth);

  function selectShortcut(shortcut) {
    setSelectedKey(shortcut.key);
    setShowCustom(false);
    onChange({ from: shortcut.from, to: shortcut.to });
  }

  function selectCustom() {
    setSelectedKey('custom');
    setShowCustom(true);
  }

  return (
    <div className="date-range-selector">
      <div className="date-range-selector-shortcuts">
        {shortcuts.map((shortcut) => (
          <button
            key={shortcut.key}
            type="button"
            className={`date-range-shortcut${selectedKey === shortcut.key ? ' is-active' : ''}`}
            onClick={() => selectShortcut(shortcut)}
          >
            {shortcut.label}
          </button>
        ))}
        <button
          type="button"
          className={`date-range-shortcut${selectedKey === 'custom' ? ' is-active' : ''}`}
          onClick={selectCustom}
        >
          Personalizado
        </button>
      </div>
      {showCustom && (
        <div className="date-range-selector-custom">
          <label>
            Desde
            <input
              type="date"
              value={value?.from || ''}
              onChange={(e) => onChange({ from: e.target.value, to: value?.to || '' })}
            />
          </label>
          <label>
            Hasta
            <input
              type="date"
              value={value?.to || ''}
              onChange={(e) => onChange({ from: value?.from || '', to: e.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  );
}
