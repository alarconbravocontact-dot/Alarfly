import { useCallback, useEffect, useState } from 'react';
import { vendorsApi } from '../../api/ap';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';

const EMPTY_FORM = { name: '', taxId: '', email: '', phone: '', paymentTermsDays: 30 };

export default function VendorsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';

  const [vendors, setVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [rowErrors, setRowErrors] = useState({});

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadVendors = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await vendorsApi.list();
      setVendors(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar los proveedores.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVendors();
  }, [loadVendors]);

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      await vendorsApi.create({
        name: form.name,
        taxId: form.taxId || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        paymentTermsDays: form.paymentTermsDays ? Number(form.paymentTermsDays) : undefined,
      });
      setForm(EMPTY_FORM);
      setIsFormOpen(false);
      await loadVendors();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear el proveedor.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(vendor) {
    setRowErrors((prev) => ({ ...prev, [vendor.id]: '' }));
    try {
      await vendorsApi.update(vendor.id, { isActive: !vendor.isActive });
      await loadVendors();
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [vendor.id]: err instanceof ApiError ? err.message : 'No se pudo actualizar el proveedor.',
      }));
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2>Proveedores</h2>
          {canManage && (
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFormOpen((v) => !v)}>
              {isFormOpen ? 'Cancelar' : '+ Nuevo proveedor'}
            </button>
          )}
        </div>

        {canManage && isFormOpen && (
          <form onSubmit={handleCreate} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
            <div className="form-grid">
              <label className="field">
                <span>Nombre</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </label>
              <label className="field">
                <span>NIT / Cédula (opcional)</span>
                <input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
              </label>
              <label className="field">
                <span>Correo (opcional)</span>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>
              <label className="field">
                <span>Teléfono (opcional)</span>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </label>
              <label className="field">
                <span className="field-label">
                  Días para pagar
                  <HelpTooltip text="Cuántos días después de recibida una factura de este proveedor se considera su fecha de vencimiento." />
                </span>
                <input
                  type="number"
                  min={1}
                  value={form.paymentTermsDays}
                  onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })}
                />
              </label>
            </div>
            {formError && (
              <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
                {formError}
              </p>
            )}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Crear proveedor'}
              </button>
            </div>
          </form>
        )}

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && vendors.length === 0 && (
          <EmptyState icon="○" message="Todavía no registraste ningún proveedor." />
        )}
        {!isLoading && !loadError && vendors.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>NIT / Cédula</th>
                <th>Días para pagar</th>
                <th>Estado</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.id}>
                  <td>{v.name}</td>
                  <td>{v.taxId || '—'}</td>
                  <td>{v.paymentTermsDays}</td>
                  <td>
                    <StatusSeal status={v.isActive ? 'active' : 'inactive'} label={v.isActive ? 'Activo' : 'Inactivo'} />
                  </td>
                  {canManage && (
                    <td>
                      <button type="button" className="btn btn-small" onClick={() => handleToggleActive(v)}>
                        {v.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                      {rowErrors[v.id] && (
                        <p className="alert-box alert-box-error" style={{ marginTop: 6 }}>
                          {rowErrors[v.id]}
                        </p>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
