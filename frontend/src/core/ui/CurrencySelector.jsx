import { useCurrency } from '../../context/CurrencyContext';
import './CurrencySelector.css';

// Selector de divisa de visualización, visible en toda la app (montado
// en el topbar). Cambiar de moneda aplica y guarda de inmediato — mismo
// criterio ya usado por el selector de tema (ThemeContext), no espera a
// un botón "Guardar" aparte.
export default function CurrencySelector() {
  const { baseCurrency, displayCurrency, setDisplayCurrency, availableCurrencies } = useCurrency();

  return (
    <div className="currency-selector" title="Moneda en la que se muestran los montos convertidos">
      <select
        value={displayCurrency || baseCurrency}
        onChange={(e) => setDisplayCurrency(e.target.value === baseCurrency ? '' : e.target.value)}
      >
        {availableCurrencies.map((code) => (
          <option key={code} value={code}>
            {code === baseCurrency ? `${code} (moneda base)` : code}
          </option>
        ))}
      </select>
    </div>
  );
}
