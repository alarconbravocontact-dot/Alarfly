import { useCallback, useEffect, useState } from 'react';
import { affiliateAdminApi } from '../../api/affiliate-admin';
import { ApiError } from '../../api/client';
import { useConfirm } from '../../context/ConfirmContext';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';
import Breadcrumb from '../../core/ui/Breadcrumb';
import { formatCurrency, formatDate } from '../../utils/format';
import { ALLOWED_COMMISSION_TRANSITIONS, COMMISSION_STATUS_LABELS, COMMISSION_STATUS_TONE } from './affiliateStatusLabels';
import './AffiliateAdminPage.css';

// Administración CRUZADA del programa (punto 7 del pedido): vive
// DENTRO del área administrativa existente del frontend (mismo patrón
// de ruta suelta que ya usa `/niveles-de-acceso`/`/auditoria`, montada
// bajo el AppLayout normal) — no es un segundo panel administrativo
// aparte, es una pantalla más de las que ya administra un
// Administrador. El backend es quien de verdad protege esto
// (`requireAffiliateProgramAdmin`); esta pantalla ni siquiera se monta
// en la navegación si `amIAdmin()` da false (ver AppLayout.jsx).
export default function AffiliateAdminPage() {
  const confirm = useConfirm();
  const [affiliates, setAffiliates] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [settings, setSettings] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [settingsForm, setSettingsForm] = useState(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [affiliatesData, commissionsData, settingsData] = await Promise.all([
        affiliateAdminApi.listAffiliates(),
        affiliateAdminApi.listCommissions({ status: statusFilter || undefined }),
        affiliateAdminApi.getSettings(),
      ]);
      setAffiliates(affiliatesData);
      setCommissions(commissionsData);
      setSettings(settingsData);
      setSettingsForm({
        rateType: settingsData.rateType,
        rateValue: settingsData.rateValue,
        referenceAmount: settingsData.referenceAmount,
        currency: settingsData.currency,
      });
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar la administración de afiliados.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleTransition(commission, nextStatus) {
    const ok = await confirm({
      title: `¿${COMMISSION_STATUS_LABELS[nextStatus]}?`,
      message: `La comisión de ${formatCurrency(commission.amount, commission.currency)} (${commission.affiliate.name}) pasará a "${COMMISSION_STATUS_LABELS[nextStatus]}".`,
      tone: nextStatus === 'CANCELLED' ? 'danger' : 'default',
    });
    if (!ok) return;
    let note;
    if (nextStatus === 'CANCELLED') {
      note = window.prompt('Motivo de la cancelación (opcional):') || undefined;
    }
    await affiliateAdminApi.transitionCommission(commission.id, nextStatus, note);
    load();
  }

  async function handleToggleAffiliateStatus(affiliate) {
    const nextStatus = affiliate.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const ok = await confirm({
      title: nextStatus === 'SUSPENDED' ? 'Suspender afiliado' : 'Reactivar afiliado',
      message: `${affiliate.name} quedará "${nextStatus === 'SUSPENDED' ? 'Suspendido' : 'Activo'}".`,
      tone: nextStatus === 'SUSPENDED' ? 'danger' : 'default',
    });
    if (!ok) return;
    await affiliateAdminApi.setAffiliateStatus(affiliate.id, nextStatus);
    load();
  }

  async function handleSaveSettings(event) {
    event.preventDefault();
    setIsSavingSettings(true);
    setSettingsMessage('');
    try {
      await affiliateAdminApi.updateSettings(settingsForm);
      setSettingsMessage('Configuración guardada.');
      load();
    } catch (err) {
      setSettingsMessage(err instanceof ApiError ? err.message : 'No se pudo guardar.');
    } finally {
      setIsSavingSettings(false);
    }
  }

  if (isLoading) return <p className="page-subtitle">Cargando…</p>;
  if (loadError) {
    return (
      <p className="login-error" role="alert">
        {loadError}
      </p>
    );
  }

  return (
    <div className="page">
      <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Administración de Afiliados' }]} />
      <div className="page-header">
        <h1>Administración de Afiliados</h1>
        <p className="page-subtitle">Afiliados, referidos y comisiones de todo el programa — vista cruzada de plataforma.</p>
      </div>

      <h2 className="affiliate-section-title">Configuración de comisión</h2>
      {settingsForm && (
        <form className="affiliate-settings-form" onSubmit={handleSaveSettings}>
          <label>
            <span>Tipo</span>
            <select
              value={settingsForm.rateType}
              onChange={(e) => setSettingsForm({ ...settingsForm, rateType: e.target.value })}
            >
              <option value="FLAT">Monto fijo</option>
              <option value="PERCENTAGE">Porcentaje del precio de referencia</option>
            </select>
          </label>
          <label>
            <span>{settingsForm.rateType === 'FLAT' ? 'Monto fijo' : 'Porcentaje (%)'}</span>
            <input
              type="number"
              step="0.01"
              value={settingsForm.rateValue}
              onChange={(e) => setSettingsForm({ ...settingsForm, rateValue: e.target.value })}
            />
          </label>
          <label>
            <span>Precio de referencia (para %)</span>
            <input
              type="number"
              step="0.01"
              value={settingsForm.referenceAmount}
              onChange={(e) => setSettingsForm({ ...settingsForm, referenceAmount: e.target.value })}
            />
          </label>
          <label>
            <span>Moneda</span>
            <input
              type="text"
              value={settingsForm.currency}
              onChange={(e) => setSettingsForm({ ...settingsForm, currency: e.target.value })}
            />
          </label>
          <button type="submit" className="btn btn-primary btn-small" disabled={isSavingSettings}>
            {isSavingSettings ? 'Guardando…' : 'Guardar'}
          </button>
          {settingsMessage && <p className="page-subtitle">{settingsMessage}</p>}
        </form>
      )}
      {settings && (
        <p className="page-subtitle">
          Esta configuración solo aplica a comisiones NUEVAS — un cambio de tasa nunca recalcula una comisión ya generada.
        </p>
      )}

      <h2 className="affiliate-section-title">Afiliados ({affiliates.length})</h2>
      {affiliates.length === 0 ? (
        <EmptyState icon="◷" message="Todavía no hay ningún afiliado registrado." />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Código</th>
              <th>Referidos</th>
              <th>Estado</th>
              <th>También es cliente</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {affiliates.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.email}</td>
                <td>
                  <code>{a.code}</code>
                </td>
                <td>{a._count.referrals}</td>
                <td>
                  <StatusSeal status={a.status === 'ACTIVE' ? 'active' : 'inactive'} label={a.status === 'ACTIVE' ? 'Activo' : 'Suspendido'} />
                </td>
                <td>{a.linkedUser ? `Sí (${a.linkedUser.email})` : 'No'}</td>
                <td>
                  <button type="button" className="btn btn-small" onClick={() => handleToggleAffiliateStatus(a)}>
                    {a.status === 'ACTIVE' ? 'Suspender' : 'Reactivar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="affiliate-section-title">Comisiones</h2>
      <label className="affiliate-filter">
        <span>Filtrar por estado</span>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todas</option>
          {Object.keys(COMMISSION_STATUS_LABELS).map((s) => (
            <option key={s} value={s}>
              {COMMISSION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      {commissions.length === 0 ? (
        <EmptyState icon="○" message="No hay comisiones con este filtro." />
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Afiliado</th>
              <th>Empresa referida</th>
              <th className="num">Monto</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {commissions.map((c) => (
              <tr key={c.id}>
                <td>{formatDate(new Date(c.createdAt))}</td>
                <td>
                  {c.affiliate.name} ({c.affiliate.code})
                </td>
                <td>{c.referral?.referredCompany?.name}</td>
                <td className="num">{formatCurrency(c.amount, c.currency)}</td>
                <td>
                  <StatusSeal tone={COMMISSION_STATUS_TONE[c.status]} label={COMMISSION_STATUS_LABELS[c.status]} />
                </td>
                <td>
                  <div className="btn-row">
                    {(ALLOWED_COMMISSION_TRANSITIONS[c.status] || []).map((next) => (
                      <button
                        key={next}
                        type="button"
                        className={`btn btn-small ${next === 'CANCELLED' ? 'btn-danger' : 'btn-primary'}`}
                        onClick={() => handleTransition(c, next)}
                      >
                        {COMMISSION_STATUS_LABELS[next]}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
