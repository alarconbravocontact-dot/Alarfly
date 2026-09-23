import { useCallback, useEffect, useState } from 'react';
import { warehousesApi } from '../../api/inventory';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';

const EMPTY_FORM = { code: '', name: '', address: '', isDefault: false };

export default function WarehousesPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';

  const [warehouses, setWarehouses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [rowErrors, setRowErrors] = useState({});

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadWarehouses = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await warehousesApi.list();
      setWarehouses(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar los almacenes.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWarehouses();
  }, [loadWarehouses]);

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      await warehousesApi.create({
        code: form.code,
        name: form.name,
        address: form.address || undefined,
        isDefault: form.isDefault,
      });
      setForm(EMPTY_FORM);
      setIsFormOpen(false);
      await loadWarehouses();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear el almacén.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(warehouse) {
    setRowErrors((prev) => ({ ...prev, [warehouse.id]: '' }));
    try {
      await warehousesApi.update(warehouse.id, { isActive: !warehouse.isActive });
      await loadWarehouses();
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [warehouse.id]: err instanceof ApiError ? err.message : 'No se pudo actualizar el almacén.',
      }));
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2>Almacenes</h2>
          {canManage && (
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFormOpen((v) => !v)}>
              {isFormOpen ? 'Cancelar' : '+ Nuevo almacén'}
            </button>
          )}
        </div>

        {canManage && isFormOpen && (
          <form onSubmit={handleCreate} className="form-grid" style={{ marginBottom: 20 }}>
            <label className="field">
              <span>Código</span>
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            </label>
            <label className="field">
              <span>Nombre</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label className="field">
              <span>Dirección (opcional)</span>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </label>
            <label className="field field-checkbox">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} />
              <span>Almacén por defecto</span>
            </label>
            {formError && (
              <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>
                {formError}
              </p>
            )}
            <div className="btn-row" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Crear almacén'}
              </button>
            </div>
          </form>
        )}

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && warehouses.length === 0 && (
          <EmptyState icon="◇" message="Todavía no creaste ningún almacén." />
        )}
        {!isLoading && !loadError && warehouses.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Dirección</th>
                <th>Por defecto</th>
                <th>Estado</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {warehouses.map((w) => (
                <tr key={w.id}>
                  <td>{w.code}</td>
                  <td>{w.name}</td>
                  <td>{w.address || '—'}</td>
                  <td>{w.isDefault ? 'Sí' : 'No'}</td>
                  <td>
                    <StatusSeal status={w.isActive ? 'active' : 'inactive'} label={w.isActive ? 'Activo' : 'Inactivo'} />
                  </td>
                  {canManage && (
                    <td>
                      <button type="button" className="btn btn-small" onClick={() => handleToggleActive(w)}>
                        {w.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                      {rowErrors[w.id] && (
                        <p className="alert-box alert-box-error" style={{ marginTop: 6 }}>
                          {rowErrors[w.id]}
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
