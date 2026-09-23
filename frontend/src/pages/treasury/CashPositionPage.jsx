import { useCallback, useEffect, useState } from 'react';
import { treasuryAccountsApi } from '../../api/treasury';
import { accountsApi } from '../../api/accounting';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/format';
import StatCard from '../../components/StatCard';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';
import SyncIndicator from '../../core/ui/SyncIndicator';

const EMPTY_FORM = {
  type: 'BANK_ACCOUNT',
  name: '',
  currency: 'USD',
  bankName: '',
  accountNumber: '',
  creditLimit: '',
  glAccountId: '',
};

export default function CashPositionPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN';

  const [cashPosition, setCashPosition] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [glAccounts, setGlAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [cashData, accountsData, glData] = await Promise.all([
        treasuryAccountsApi.cashPosition(),
        treasuryAccountsApi.list(),
        accountsApi.list({ isActive: true }),
      ]);
      setCashPosition(cashData);
      setAccounts(accountsData);
      setGlAccounts(glData.filter((a) => a.isPostable));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar la información de tesorería.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      await treasuryAccountsApi.create({
        ...form,
        creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined,
        bankName: form.bankName || undefined,
        accountNumber: form.accountNumber || undefined,
      });
      setForm(EMPTY_FORM);
      setIsFormOpen(false);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page">
      {isLoading && <p className="text-muted">Cargando…</p>}
      {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}

      {!isLoading && !loadError && cashPosition && (
        <section className="dashboard-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <StatCard
            label="Posición de caja consolidada"
            value={formatCurrency(cashPosition.totalInBaseCurrency, cashPosition.baseCurrency)}
          />
          <StatCard
            label="Crédito disponible"
            value={formatCurrency(cashPosition.availableCreditInBaseCurrency, cashPosition.baseCurrency)}
          />
          <StatCard
            label="Colchón de liquidez"
            value={formatCurrency(cashPosition.liquidityCushion, cashPosition.baseCurrency)}
            hint="Caja + crédito disponible"
          />
        </section>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Cuentas bancarias y tarjetas</h2>
          {canManage && (
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFormOpen((v) => !v)}>
              {isFormOpen ? 'Cancelar' : '+ Nueva cuenta'}
            </button>
          )}
        </div>

        {canManage && isFormOpen && (
          <form onSubmit={handleCreate} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
            <div className="form-grid">
              <label className="field">
                <span>Tipo</span>
                <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="BANK_ACCOUNT">Cuenta bancaria</option>
                  <option value="CREDIT_CARD">Tarjeta de crédito</option>
                </select>
              </label>
              <label className="field">
                <span>Nombre</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Banco Nación - Cuenta Corriente"
                  required
                />
              </label>
              <label className="field">
                <span>Moneda (ISO)</span>
                <input
                  value={form.currency}
                  onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                  placeholder="USD"
                  maxLength={3}
                  required
                />
              </label>
              <label className="field">
                <span>Banco (opcional)</span>
                <input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} />
              </label>
              <label className="field">
                <span>N.º de cuenta (opcional)</span>
                <input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} />
              </label>
              {form.type === 'CREDIT_CARD' && (
                <label className="field">
                  <span>Límite de crédito</span>
                  <input
                    type="number"
                    step="0.01"
                    value={form.creditLimit}
                    onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                    required
                  />
                </label>
              )}
              <label className="field">
                <span className="field-label">
                  Cuenta contable asociada
                  <HelpTooltip text="A qué cuenta del Plan de Cuentas de Contabilidad corresponde este banco o tarjeta (ej. “Bancos”). Es lo que conecta el saldo real con los reportes contables." />
                </span>
                <select value={form.glAccountId} onChange={(e) => setForm({ ...form, glAccountId: e.target.value })} required>
                  <option value="">Selecciona una cuenta</option>
                  {glAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} · {a.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {formError && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{formError}</p>}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Crear cuenta'}
              </button>
            </div>
          </form>
        )}

        {!isLoading && !loadError && accounts.length === 0 && (
          <EmptyState icon="◆" message="Todavía no registraste ninguna cuenta bancaria ni tarjeta." />
        )}

        {!isLoading && !loadError && accounts.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Moneda</th>
                <th className="num">Saldo</th>
                <th>Estado</th>
                <th>
                  Sincronización
                  <HelpTooltip text="Muestra cuándo se importó el último extracto de esta cuenta: verde (menos de 24h), amarillo (entre 24 y 48h) o rojo (48h o más sin importar nada — haz clic para reconectar)." />
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.name}
                    {a.bankName && <span className="text-muted"> — {a.bankName}</span>}
                  </td>
                  <td>{a.type === 'BANK_ACCOUNT' ? 'Cuenta bancaria' : 'Tarjeta de crédito'}</td>
                  <td>{a.currency}</td>
                  <td className="num">{formatCurrency(a.currentBalance, a.currency)}</td>
                  <td>
                    <StatusSeal status={a.isActive ? 'active' : 'inactive'} label={a.isActive ? 'Activa' : 'Inactiva'} />
                  </td>
                  <td>
                    <SyncIndicator status={a.syncStatus} lastSyncAt={a.lastSyncAt} />
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
