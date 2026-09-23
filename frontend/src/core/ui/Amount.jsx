import { useIncognito } from '../../context/IncognitoContext';
import { formatCurrency } from '../../utils/format';
import CountUpNumber from './CountUpNumber';

// Envuelve un monto en moneda base con conteo progresivo (Feature O),
// genérico y reutilizable para cualquier pantalla que hoy llama a
// `formatCurrency` directo — a diferencia de `ConvertedAmount`, no
// aplica conversión de moneda de visualización, solo formatea y
// enmascara en modo incógnito (Feature V).
export default function Amount({ value, currency }) {
  const { isIncognito } = useIncognito();

  if (isIncognito) {
    return <span aria-label="Monto oculto (modo incógnito)">••••••</span>;
  }

  return <CountUpNumber value={Number(value)} format={(n) => formatCurrency(n, currency)} />;
}
