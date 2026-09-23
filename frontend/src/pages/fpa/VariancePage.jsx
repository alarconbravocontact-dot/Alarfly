import { useCallback, useEffect, useState } from 'react';
import { budgetVarianceApi, budgetsApi } from '../../api/fpa';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';

export default function VariancePage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'FINANCE';

  const [settings, setSettings] = useState(null);
  const [threshold, setThreshold] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [budgets, setBudgets] = useState([]);
  const [budgetId, setBudgetId] = useState('');
  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [justifyingLineId, setJustifyingLineId] = useState(null);
  const [justifyComment, setJustifyComment] = useState('');
  const [justifyError, setJustifyError] = useState('');

  useEffect(() => {
    budgetVarianceApi
      .getSettings()
      .then((data) => {
        setSettings(data);
        setThreshold(data.varianceThresholdPercentage);
      })
      .catch(() => {});
    budgetsApi
      .list()
      .then(setBudgets)
      .catch(() => setBudgets([]));
  }, []);

  const loadReport = useCallback(async (id) => {
    if (!id) {
      setReport(null);
      return;
    }
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await budgetVarianceApi.getReport(id);
      setReport(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar el reporte de desviación.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  async function handleSaveSettings(event) {
    event.preventDefault();
    setSettingsError('');
    setIsSavingSettings(true);
    try {
      const updated = await budgetVarianceApi.updateSettings({ varianceThresholdPercentage: Number(threshold) });
      setSettings(updated);
    } catch (err) {
      setSettingsError(err instanceof ApiError ? err.message : 'No se pudo guardar el umbral.');
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleJustify(line) {
    setJustifyError('');
    if (!justifyComment.trim()) {
      setJustifyError('Escribe una justificación antes de enviar.');
      return;
    }
    try {
      await budgetVarianceApi.justify(line.lineId, justifyComment);
      setJustifyingLineId(null);
      setJustifyComment('');
      await loadReport(budgetId);
    } catch (err) {
      setJustifyError(err instanceof ApiError ? err.message : 'No se pudo guardar la justificación.');
    }
  }

  return (
    <div className="page">
      {canManage && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="field-label">
              Umbral de desviación
              <HelpTooltip text="Cuando lo real se aleja del presupuesto más de este porcentaje, la línea queda marcada como “requiere justificación” — es la señal de que alguien debe explicar qué pasó." />
            </h2>
          </div>
          <form onSubmit={handleSaveSettings} className="btn-row" style={{ alignItems: 'center' }}>
            <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <input
                type="number"
                min="0"
                max="1000"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                style={{
                  width: 90,
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 9px',
                }}
              />
              <span>%</span>
            </label>
            <button type="submit" className="btn btn-primary btn-small" disabled={isSavingSettings}>
              {isSavingSettings ? 'Guardando…' : 'Guardar'}
            </button>
          </form>
          {settingsError && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{settingsError}</p>}
          {settings && (
            <p className="text-muted" style={{ marginTop: 8 }}>
              Umbral actual: {settings.varianceThresholdPercentage}%
            </p>
          )}
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Reporte de desviación</h2>
        </div>
        <label className="field" style={{ maxWidth: 360, marginBottom: 16 }}>
          <span>Presupuesto</span>
          <select
            value={budgetId}
            onChange={(e) => {
              setBudgetId(e.target.value);
              loadReport(e.target.value);
            }}
          >
            <option value="">Selecciona un presupuesto</option>
            {budgets.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} — {b.fiscalYear} (v{b.versionNumber})
              </option>
            ))}
          </select>
        </label>

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && budgetId && report && report.lines.length === 0 && (
          <EmptyState icon="○" message="Este presupuesto todavía no tiene líneas para comparar contra lo real." />
        )}

        {!isLoading && !loadError && report && report.lines.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Cuenta</th>
                <th>Dimensión</th>
                <th>Mes</th>
                <th className="num">Presupuestado</th>
                <th className="num">Real</th>
                <th className="num">Desviación</th>
                <th>
                  <span className="field-label">
                    Estado
                    <HelpTooltip text="Si la desviación supera el umbral configurado, la línea necesita una justificación. Ya justificada significa que alguien explicó el motivo y los montos no han vuelto a cambiar desde entonces." />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {report.lines.map((line) => (
                <tr key={line.lineId}>
                  <td>
                    {line.account.code} · {line.account.name}
                  </td>
                  <td>{line.fpaDimension.name}</td>
                  <td>{line.period}</td>
                  <td className="num">{formatCurrency(line.budgetedAmount)}</td>
                  <td className="num">{formatCurrency(line.actualAmount)}</td>
                  <td className="num">
                    {formatCurrency(line.varianceAmount)} ({line.variancePercentage}%)
                  </td>
                  <td>
                    {!line.requiresJustification && <StatusSeal status="active" label="Dentro del umbral" />}
                    {line.requiresJustification && line.isJustified && <StatusSeal status="active" label="Justificada" />}
                    {line.requiresJustification && !line.isJustified && (
                      <div>
                        <StatusSeal status="pending" label="Requiere justificación" />
                        {canManage && justifyingLineId !== line.lineId && (
                          <button
                            type="button"
                            className="btn btn-small"
                            style={{ marginTop: 6 }}
                            onClick={() => {
                              setJustifyingLineId(line.lineId);
                              setJustifyComment('');
                              setJustifyError('');
                            }}
                          >
                            Justificar
                          </button>
                        )}
                        {canManage && justifyingLineId === line.lineId && (
                          <div style={{ marginTop: 6 }}>
                            <textarea
                              value={justifyComment}
                              onChange={(e) => setJustifyComment(e.target.value)}
                              placeholder="Explica por qué hubo esta desviación"
                              rows={2}
                              style={{
                                width: 220,
                                background: 'var(--color-bg)',
                                border: '1px solid var(--color-border)',
                                borderRadius: 'var(--radius-sm)',
                                padding: '6px 9px',
                              }}
                            />
                            {justifyError && <p className="alert-box alert-box-error" style={{ marginTop: 6 }}>{justifyError}</p>}
                            <div className="btn-row" style={{ marginTop: 6 }}>
                              <button type="button" className="btn btn-small btn-primary" onClick={() => handleJustify(line)}>
                                Enviar
                              </button>
                              <button type="button" className="btn btn-small" onClick={() => setJustifyingLineId(null)}>
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
