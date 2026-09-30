import { useEffect, useState } from 'react';
import { arApSettingsApi, customersApi } from '../../api/ar';
import { accountsApi } from '../../api/accounting';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import HelpTooltip from '../../components/HelpTooltip';

// F17-E2/E3: bug real de severidad alta encontrado auditando el
// recorrido de una empresa nueva de verdad — sin esto, ni una factura
// de venta ni una de compra se pueden registrar nunca ("Todavía no se
// configuró la cuenta contable de Cuentas por Cobrar/Pagar.
// Configúrala en Ajustes antes de facturar."), pero esa pantalla de
// "Ajustes" no existía en ningún lugar del producto — el servicio de
// backend (`core/ar-ap-settings`) ya estaba completo y probado desde
// Fase 3, nunca tuvo ninguna interfaz.
export default function ArApSettingsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN';

  const [accounts, setAccounts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [receivableGlAccountId, setReceivableGlAccountId] = useState('');
  const [payableGlAccountId, setPayableGlAccountId] = useState('');
  const [defaultCustomerId, setDefaultCustomerId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let isMounted = true;
    Promise.all([arApSettingsApi.get(), accountsApi.list({ isActive: true }), customersApi.list()])
      .then(([settings, accountsData, customersData]) => {
        if (!isMounted) return;
        setAccounts(accountsData);
        setCustomers(customersData);
        setReceivableGlAccountId(settings.receivableGlAccountId || '');
        setPayableGlAccountId(settings.payableGlAccountId || '');
        setDefaultCustomerId(settings.defaultCustomerId || '');
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar la configuración.'))
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSave(event) {
    event.preventDefault();
    setSaveError('');
    setSaveMessage('');
    setIsSaving(true);
    try {
      await arApSettingsApi.update({
        receivableGlAccountId: receivableGlAccountId || undefined,
        payableGlAccountId: payableGlAccountId || undefined,
        defaultCustomerId: defaultCustomerId || null,
      });
      setSaveMessage('Configuración guardada.');
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'No se pudo guardar la configuración.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <p className="text-muted">Cargando…</p>;

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2>Ajustes de Cuentas por Cobrar y Pagar</h2>
        </div>
        <p className="text-muted" style={{ marginBottom: 16 }}>
          Esta configuración es necesaria antes de poder registrar cualquier factura de venta o de compra.
        </p>
        {loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!loadError && (
          <form onSubmit={handleSave} className="form-grid">
            <label className="field">
              <span className="field-label">
                Cuenta contable de Cuentas por Cobrar
                <HelpTooltip text="A qué cuenta del Plan de Cuentas se registra automáticamente lo que te deben tus clientes cada vez que emites una factura de venta." />
              </span>
              <select value={receivableGlAccountId} onChange={(e) => setReceivableGlAccountId(e.target.value)} disabled={!canManage} required>
                <option value="">Selecciona una cuenta</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">
                Cuenta contable de Cuentas por Pagar
                <HelpTooltip text="A qué cuenta del Plan de Cuentas se registra automáticamente lo que le debes a tus proveedores cada vez que registras una factura de compra." />
              </span>
              <select value={payableGlAccountId} onChange={(e) => setPayableGlAccountId(e.target.value)} disabled={!canManage} required>
                <option value="">Selecciona una cuenta</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">
                Cliente “Consumidor Final” (opcional)
                <HelpTooltip text="Si vendes a personas que no quieres registrar una por una (ej. ventas de mostrador), elige aquí un cliente genérico — Venta Rápida lo usa solo si no eliges ningún cliente." />
              </span>
              <select value={defaultCustomerId} onChange={(e) => setDefaultCustomerId(e.target.value)} disabled={!canManage}>
                <option value="">Sin cliente por defecto</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {canManage && (
              <div className="btn-row" style={{ gridColumn: '1 / -1' }}>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Guardando…' : 'Guardar configuración'}
                </button>
              </div>
            )}
            {saveMessage && (
              <p className="alert-box alert-box-success" style={{ gridColumn: '1 / -1' }}>
                {saveMessage}
              </p>
            )}
            {saveError && (
              <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>
                {saveError}
              </p>
            )}
            {!canManage && (
              <p className="text-muted" style={{ gridColumn: '1 / -1' }}>
                Solo un Administrador puede cambiar esta configuración.
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
