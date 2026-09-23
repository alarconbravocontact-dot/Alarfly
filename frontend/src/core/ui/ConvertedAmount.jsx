import { useCurrency } from '../../context/CurrencyContext';
import { useIncognito } from '../../context/IncognitoContext';
import { formatCurrency } from '../../utils/format';
import CountUpNumber from './CountUpNumber';
import './ConvertedAmount.css';

// Envuelve cualquier monto en moneda base y lo muestra convertido a la
// moneda de visualización elegida (`CurrencySelector`, en el topbar),
// usando la tasa del día ya cargada por `CurrencyContext` — nunca
// recalcula ni pide una tasa nueva por su cuenta. Si no hay conversión
// activa (sin moneda elegida, ya es la moneda base, o no hay tasa
// registrada), se comporta como un `formatCurrency` normal, sin
// ninguna etiqueta ni tooltip — el monto contable real nunca cambia.
//
// Modo incógnito (Feature V): si está activo, muestra asteriscos en
// vez del monto real — el propio dato nunca sale del componente hacia
// el DOM visible, no es solo un blur de CSS.
export default function ConvertedAmount({ amount, tabIndex = 0 }) {
  const { convert } = useCurrency();
  const { isIncognito } = useIncognito();
  const result = convert(amount);

  if (isIncognito) {
    return <span aria-label="Monto oculto (modo incógnito)">••••••</span>;
  }

  if (!result.isConverted) {
    return (
      <span>
        <CountUpNumber value={result.amount} format={(n) => formatCurrency(n, result.currency)} />
      </span>
    );
  }

  return (
    <span className="converted-amount" tabIndex={tabIndex}>
      <span>
        <CountUpNumber value={result.amount} format={(n) => formatCurrency(n, result.currency)} />
      </span>
      <span className="converted-amount-label">(convertido, solo referencia)</span>
      <span className="converted-amount-tooltip" role="tooltip">
        <span className="converted-amount-tooltip-row">
          Original: {formatCurrency(result.originalAmount, result.originalCurrency)}
        </span>
        <span className="converted-amount-tooltip-row">
          Tasa usada: 1 {result.currency} = {result.rate} {result.originalCurrency}
        </span>
      </span>
    </span>
  );
}
