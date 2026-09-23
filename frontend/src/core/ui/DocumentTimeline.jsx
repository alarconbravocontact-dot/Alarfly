import { formatDate } from '../../utils/format';
import './DocumentTimeline.css';

// Línea de tiempo visual genérica de un documento: recibe los `steps`
// ya armados por el backend a partir del AuditLog real (nunca inventa
// eventos acá) y un `anomaly` opcional ({onStepIndex, averageDays}) que
// resalta el paso donde hubo una demora fuera de lo normal para ese
// cliente. Pensado para reutilizarse en cualquier documento con su
// propio historial de auditoría, no solo facturas de venta.
export default function DocumentTimeline({ steps, anomaly }) {
  if (!steps || steps.length === 0) {
    return <p className="text-muted">Todavía no hay movimientos registrados.</p>;
  }

  return (
    <ol className="ui-doc-timeline">
      {steps.map((step, index) => {
        const isAnomalous = anomaly && anomaly.onStepIndex === index;
        return (
          <li key={step.auditLogId} className={`ui-doc-timeline-step${isAnomalous ? ' ui-doc-timeline-step-anomaly' : ''}`}>
            <div className="ui-doc-timeline-dot" aria-hidden="true" />
            <div className="ui-doc-timeline-content">
              <div className="ui-doc-timeline-header">
                <span className="ui-doc-timeline-label">{step.label}</span>
                <span className="ui-doc-timeline-date">{formatDate(new Date(step.date))}</span>
              </div>
              <p className="ui-doc-timeline-meta">
                {step.userName}
                {step.relatedDocument && <> · vía {step.relatedDocument}</>}
              </p>
              {isAnomalous && (
                <p className="ui-doc-timeline-anomaly-note">
                  ⚠ Tardó bastante más de lo usual para este cliente (promedio histórico: {anomaly.averageDays} día
                  {anomaly.averageDays === 1 ? '' : 's'}).
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
