import { useEffect, useState } from 'react';
import { personalSettingsApi } from '../../api/personal';
import { accountsApi } from '../../api/accounting';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import HelpTooltip from '../../components/HelpTooltip';
import FormField from '../../core/ui/FormField';

function flattenAccounts(tree, acc = []) {
  for (const node of tree) {
    if (node.isPostable) acc.push(node);
    if (node.children) flattenAccounts(node.children, acc);
  }
  return acc;
}

export default function PersonalSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [settings, setSettings] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([personalSettingsApi.get(), accountsApi.tree()])
      .then(([settingsData, tree]) => {
        setSettings(settingsData);
        setAccounts(flattenAccounts(tree));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudieron cargar los ajustes.'))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleSave(event) {
    event.preventDefault();
    setIsSaving(true);
    setSaved(false);
    setError('');
    try {
      const updated = await personalSettingsApi.update({
        payrollExpenseAccountId: settings.payrollExpenseAccountId || undefined,
        payrollPayableAccountId: settings.payrollPayableAccountId || undefined,
        expenseAccountId: settings.expenseAccountId || undefined,
        expenseReimbursementPayableAccountId: settings.expenseReimbursementPayableAccountId || undefined,
      });
      setSettings(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudieron guardar los ajustes.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <p className="text-muted">Cargando…</p>;

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="field-label">
          Ajustes
          <HelpTooltip text="A qué cuenta contable va el gasto de nómina/reembolsos y a qué cuenta de pasivo (por pagar) mientras no se le ha pagado al empleado. Sin esto configurado, no se pueden aprobar nóminas ni gastos." />
        </h2>
      </div>

      {!isAdmin && <p className="alert-box">Solo el Administrador puede cambiar estos ajustes — puedes verlos, pero no editarlos.</p>}
      {error && <p className="alert-box alert-box-error">{error}</p>}
      {saved && <p className="alert-box alert-box-success">Ajustes guardados.</p>}

      <form onSubmit={handleSave}>
        <h3 className="field-label">Nómina</h3>
        <div className="form-grid">
          <FormField label="Cuenta de gasto de nómina">
            <select
              disabled={!isAdmin}
              value={settings.payrollExpenseAccountId || ''}
              onChange={(e) => setSettings({ ...settings, payrollExpenseAccountId: e.target.value })}
            >
              <option value="">Sin configurar</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Cuenta de sueldos por pagar">
            <select
              disabled={!isAdmin}
              value={settings.payrollPayableAccountId || ''}
              onChange={(e) => setSettings({ ...settings, payrollPayableAccountId: e.target.value })}
            >
              <option value="">Sin configurar</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <h3 className="field-label" style={{ marginTop: 16 }}>
          Gastos de Personal
        </h3>
        <div className="form-grid">
          <FormField label="Cuenta de gasto de reembolsos">
            <select
              disabled={!isAdmin}
              value={settings.expenseAccountId || ''}
              onChange={(e) => setSettings({ ...settings, expenseAccountId: e.target.value })}
            >
              <option value="">Sin configurar</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Cuenta de reembolsos por pagar">
            <select
              disabled={!isAdmin}
              value={settings.expenseReimbursementPayableAccountId || ''}
              onChange={(e) => setSettings({ ...settings, expenseReimbursementPayableAccountId: e.target.value })}
            >
              <option value="">Sin configurar</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.code} · {account.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        {isAdmin && (
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Guardando…' : 'Guardar ajustes'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
