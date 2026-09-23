import { Link } from 'react-router-dom';
import HelpTooltip from '../../components/HelpTooltip';
import { ACCOUNTING_TABS } from '../../config/moduleTabs';

// Fase 5, sección 24/31: "Contabilidad avanzada" es la profundidad que
// necesita un contador (Debe/Haber, cuenta, dimensión, periodo,
// asiento) — no se reconstruye nada de Contabilidad, esta pantalla solo
// enlaza a las 4 pantallas ya existentes, para que quien las necesite
// las encuentre desde Finanzas sin tener que saber que "Contabilidad"
// es otro módulo técnico aparte.
export default function ContabilidadAvanzadaPage() {
  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            Contabilidad avanzada
            <HelpTooltip text="Acá vive el detalle contable completo — Debe/Haber, cuentas, periodos, asientos — para quien lo necesita. El resto de Finanzas ya te muestra el resultado sin esa jerga." />
          </h2>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ACCOUNTING_TABS.map((tab) => (
            <li key={tab.to}>
              <Link to={tab.to}>{tab.label} →</Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
