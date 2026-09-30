import { useCallback, useEffect, useState } from 'react';
import { inventorySettingsApi, stockLevelsApi, warehousesApi } from '../../api/inventory';
import { accountsApi } from '../../api/accounting';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import EmptyState from '../../core/ui/EmptyState';

export default function StockPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';

  const [accounts, setAccounts] = useState([]);
  const [settingsForm, setSettingsForm] = useState({
    defaultValuationMethod: 'WEIGHTED_AVERAGE',
    defaultInventoryAssetAccountId: '',
    defaultCogsExpenseAccountId: '',
    defaultShrinkageExpenseAccountId: '',
  });
  const [settingsError, setSettingsError] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [levels, setLevels] = useState([]);
  const [valuation, setValuation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadAll = useCallback(async (selectedWarehouseId) => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [settingsData, accountsData, warehousesData, levelsData, valuationData] = await Promise.all([
        inventorySettingsApi.get(),
        accountsApi.list({ isActive: true }),
        warehousesApi.list({ isActive: true }),
        stockLevelsApi.list(selectedWarehouseId ? { warehouseId: selectedWarehouseId } : undefined),
        stockLevelsApi.valuation(selectedWarehouseId ? { warehouseId: selectedWarehouseId } : undefined),
      ]);
      setSettingsForm({
        defaultValuationMethod: settingsData.defaultValuationMethod || 'WEIGHTED_AVERAGE',
        defaultInventoryAssetAccountId: settingsData.defaultInventoryAssetAccountId || '',
        defaultCogsExpenseAccountId: settingsData.defaultCogsExpenseAccountId || '',
        defaultShrinkageExpenseAccountId: settingsData.defaultShrinkageExpenseAccountId || '',
      });
      setAccounts(accountsData.filter((a) => a.isPostable));
      setWarehouses(warehousesData);
      setLevels(levelsData);
      setValuation(valuationData);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar el stock.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll(warehouseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaveSettings(event) {
    event.preventDefault();
    setSettingsError('');
    setIsSavingSettings(true);
    try {
      // F17-E3: bug real encontrado en vivo — las 3 cuentas son opcionales
      // (una empresa puede no tener/querer una cuenta de merma todavía),
      // pero enviarlas como "" (en vez de omitirlas) hacía que el
      // validador del backend (`z.string().min(1).optional()`) rechazara
      // TODO el guardado con un mensaje técnico crudo, incluso cuando las
      // otras 2 cuentas sí estaban bien elegidas — nada se guardaba.
      const payload = { defaultValuationMethod: settingsForm.defaultValuationMethod };
      if (settingsForm.defaultInventoryAssetAccountId) payload.defaultInventoryAssetAccountId = settingsForm.defaultInventoryAssetAccountId;
      if (settingsForm.defaultCogsExpenseAccountId) payload.defaultCogsExpenseAccountId = settingsForm.defaultCogsExpenseAccountId;
      if (settingsForm.defaultShrinkageExpenseAccountId) payload.defaultShrinkageExpenseAccountId = settingsForm.defaultShrinkageExpenseAccountId;
      await inventorySettingsApi.update(payload);
      await loadAll(warehouseId);
    } catch (err) {
      setSettingsError(err instanceof ApiError ? err.message : 'No se pudo guardar la configuración.');
    } finally {
      setIsSavingSettings(false);
    }
  }

  return (
    <div className="page">
      {canManage && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="field-label">
              Configuración de valoración
              <HelpTooltip text="El método por defecto y las cuentas contables que se usan cuando un producto o categoría no tiene una configuración propia." />
            </h2>
          </div>
          <form onSubmit={handleSaveSettings} className="form-grid">
            <label className="field">
              <span>Método de valoración por defecto</span>
              <select
                value={settingsForm.defaultValuationMethod}
                onChange={(e) => setSettingsForm({ ...settingsForm, defaultValuationMethod: e.target.value })}
              >
                <option value="FIFO">FIFO</option>
                <option value="LIFO">LIFO</option>
                <option value="WEIGHTED_AVERAGE">Promedio ponderado</option>
              </select>
            </label>
            <label className="field">
              <span>Cuenta de inventario</span>
              <select
                value={settingsForm.defaultInventoryAssetAccountId}
                onChange={(e) => setSettingsForm({ ...settingsForm, defaultInventoryAssetAccountId: e.target.value })}
              >
                <option value="">Sin configurar</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Cuenta de costo de ventas (COGS)</span>
              <select
                value={settingsForm.defaultCogsExpenseAccountId}
                onChange={(e) => setSettingsForm({ ...settingsForm, defaultCogsExpenseAccountId: e.target.value })}
              >
                <option value="">Sin configurar</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Cuenta de merma y ajustes</span>
              <select
                value={settingsForm.defaultShrinkageExpenseAccountId}
                onChange={(e) => setSettingsForm({ ...settingsForm, defaultShrinkageExpenseAccountId: e.target.value })}
              >
                <option value="">Sin configurar</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} · {a.name}
                  </option>
                ))}
              </select>
            </label>
            {settingsError && (
              <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>
                {settingsError}
              </p>
            )}
            <div className="btn-row" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn btn-primary btn-small" disabled={isSavingSettings}>
                {isSavingSettings ? 'Guardando…' : 'Guardar configuración'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Stock por producto y almacén</h2>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <span>Almacén</span>
            <select
              value={warehouseId}
              onChange={(e) => {
                setWarehouseId(e.target.value);
                loadAll(e.target.value);
              }}
            >
              <option value="">Todos</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && levels.length === 0 && (
          <EmptyState icon="○" message="Todavía no hay existencias registradas." />
        )}
        {!isLoading && !loadError && levels.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Almacén</th>
                <th className="num">En existencia</th>
                <th className="num">Reservado</th>
                <th className="num">Disponible</th>
              </tr>
            </thead>
            <tbody>
              {levels.map((l, i) => (
                <tr key={i}>
                  <td>
                    {l.variantSku} · {l.productName}
                  </td>
                  <td>{l.warehouseName}</td>
                  <td className="num">{l.quantityOnHand}</td>
                  <td className="num">{l.quantityReserved}</td>
                  <td className="num">{l.quantityAvailable}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {valuation && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="field-label">
              Valoración del inventario
              <HelpTooltip text="El valor contable total del inventario, calculado con el método de valoración de cada producto (FIFO, LIFO o promedio ponderado)." />
            </h2>
          </div>
          <p className="text-hero" style={{ marginBottom: 16 }}>
            {formatCurrency(valuation.totalValue)}
          </p>
          <table className="data-table">
            <thead>
              <tr>
                <th>Almacén</th>
                <th className="num">Valor</th>
              </tr>
            </thead>
            <tbody>
              {valuation.byWarehouse.map((w) => (
                <tr key={w.warehouseId}>
                  <td>{w.warehouseName}</td>
                  <td className="num">{formatCurrency(w.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
