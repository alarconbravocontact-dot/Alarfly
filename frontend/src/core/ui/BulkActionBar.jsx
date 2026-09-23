import './BulkActionBar.css';

// Barra flotante fija abajo de la pantalla, genérica y reutilizable
// por cualquier tabla con selección múltiple: aparece cuando hay al
// menos un elemento seleccionado. No sabe nada de facturas, gastos ni
// de ningún otro dato de negocio — recibe `selectedCount`,
// `eligibleCount` (calculado por la pantalla que la usa, con su
// propia regla de negocio real, ej. maker-checker) y una lista de
// `actions: [{key, label, tone?, onRun: () => void}]`.
//
// "Validación mixta": una selección puede traer elementos elegibles y
// no elegibles mezclados (ej. algunos gastos ya decididos, otros
// registrados por el mismo usuario que intenta aprobarlos) — la barra
// muestra el desglose ANTES de ejecutar, y el botón de acción queda
// deshabilitado solo si NINGUNO de los seleccionados es elegible. La
// pantalla que la usa es responsable de reportar, después de ejecutar,
// qué pasó con cada elemento no elegible (nunca un éxito/fracaso
// silencioso de todo el lote).
export default function BulkActionBar({ selectedCount, eligibleCount, onClear, actions, isRunning }) {
  if (selectedCount === 0) return null;

  const ineligibleCount = selectedCount - eligibleCount;

  return (
    <div className="ui-bulk-bar" role="region" aria-label="Acciones masivas">
      <div className="ui-bulk-bar-info">
        <span className="ui-bulk-bar-count">{selectedCount} seleccionados</span>
        {ineligibleCount > 0 && (
          <span className="ui-bulk-bar-mixed">
            {eligibleCount} elegibles · {ineligibleCount} no elegibles
          </span>
        )}
      </div>
      <div className="ui-bulk-bar-actions">
        {actions.map((action) => (
          <button
            key={action.key}
            type="button"
            className={`btn btn-small${action.tone === 'danger' ? ' btn-danger' : ' btn-primary'}`}
            onClick={action.onRun}
            disabled={isRunning || eligibleCount === 0}
          >
            {isRunning ? 'Procesando…' : action.label}
          </button>
        ))}
        <button type="button" className="btn btn-small" onClick={onClear} disabled={isRunning}>
          Cancelar selección
        </button>
      </div>
    </div>
  );
}
