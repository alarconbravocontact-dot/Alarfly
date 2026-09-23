import { useCallback, useEffect, useState } from 'react';
import { quickSaleApi, paymentMethodsApi } from '../../api/sales';
import { customersApi } from '../../api/ar';
import { productsApi, warehousesApi } from '../../api/inventory';
import { accountsApi } from '../../api/accounting';
import { taxRatesApi } from '../../api/fiscal';
import { treasuryAccountsApi } from '../../api/treasury';
import { ApiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, toIsoDate } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import EntityAutocomplete from '../../core/ui/EntityAutocomplete';

// Venta Rápida (Fase 3, punto 20): registrar una venta cotidiana con el
// mínimo de interacciones posible, SIN sacrificar inventario/impuestos/
// CxC/Ledger/auditoría — llama al mismo endpoint que ya hace todo eso
// (POST /sales/quick-sale), reutilizando createInvoice/recordPayment
// tal cual. Jurisdicción fiscal y cuenta de ingreso se preseleccionan
// solas (la primera disponible) para no pedirle al usuario una decisión
// que casi siempre es la misma en cada venta.
function emptyLine() {
  return { variantId: '', variantLabel: '', warehouseId: '', description: '', quantity: 1, unitPrice: '' };
}

export default function QuickSalePage() {
  const { showToast } = useToast();

  const [customers, setCustomers] = useState([]);
  const [variants, setVariants] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [jurisdictions, setJurisdictions] = useState([]);
  const [incomeAccounts, setIncomeAccounts] = useState([]);
  const [treasuryAccounts, setTreasuryAccounts] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [customerId, setCustomerId] = useState('');
  const [jurisdictionId, setJurisdictionId] = useState('');
  const [incomeAccountId, setIncomeAccountId] = useState('');
  const [lines, setLines] = useState([emptyLine()]);
  const [collectNow, setCollectNow] = useState(true);
  const [treasuryAccountId, setTreasuryAccountId] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');

  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [customersData, productsData, warehousesData, jurisdictionsData, accountsData, treasuryData, methodsData] = await Promise.all([
        customersApi.list({ isActive: true }),
        productsApi.list({ isActive: true }),
        warehousesApi.list({ isActive: true }),
        taxRatesApi.listJurisdictions(),
        accountsApi.list(),
        treasuryAccountsApi.list(),
        paymentMethodsApi.list({ isActive: true }),
      ]);
      setCustomers(customersData);
      const flatVariants = productsData.flatMap((p) =>
        (p.variants || []).filter((v) => v.isActive).map((v) => ({ id: v.id, sku: v.sku, productName: p.name, isService: p.isService }))
      );
      setVariants(flatVariants);
      setWarehouses(warehousesData);
      setJurisdictions(jurisdictionsData);
      if (jurisdictionsData[0]) setJurisdictionId(jurisdictionsData[0].id);
      const income = accountsData.filter((a) => a.type === 'INCOME' && a.isPostable);
      setIncomeAccounts(income);
      if (income[0]) setIncomeAccountId(income[0].id);
      setTreasuryAccounts(treasuryData);
      if (treasuryData[0]) setTreasuryAccountId(treasuryData[0].id);
      setPaymentMethods(methodsData);
      if (methodsData[0]) setPaymentMethodId(methodsData[0].id);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar la información necesaria para vender.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function updateLine(index, changes) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...changes } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0), 0);

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    setLastResult(null);
    setIsSaving(true);
    try {
      const payload = {
        customerId: customerId || undefined,
        jurisdictionId,
        incomeAccountId,
        issueDate: toIsoDate(new Date()),
        lines: lines.map((l) => {
          const variant = variants.find((v) => v.id === l.variantId);
          return {
            description: l.description || (variant ? `${variant.productName} (${variant.sku})` : 'Venta'),
            variantId: l.variantId || undefined,
            warehouseId: variant && !variant.isService ? l.warehouseId || undefined : undefined,
            quantity: Number(l.quantity) || 1,
            unitPrice: Number(l.unitPrice),
          };
        }),
      };
      if (collectNow) {
        payload.payment = {
          treasuryAccountId,
          paymentMethodId: paymentMethodId || undefined,
          amount: paymentAmount ? Number(paymentAmount) : total,
        };
      }

      const result = await quickSaleApi.create(payload);
      setLastResult(result);
      showToast({
        message: `Venta registrada: factura N.º ${result.invoice.invoiceNumber} por ${formatCurrency(result.invoice.totalAmount)}${
          result.payment ? ', cobrada' : ''
        }.`,
      });
      setLines([emptyLine()]);
      setPaymentAmount('');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo registrar la venta.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <p className="text-muted">Cargando…</p>;
  if (loadError) return <p className="alert-box alert-box-error">{loadError}</p>;

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Venta Rápida</h2>
        <HelpTooltip text="Registra una venta del día a día en pocos pasos: elige el producto, confirma el precio y registra — el inventario, los impuestos, la cuenta por cobrar y el asiento contable se generan solos, igual que en una venta completa." />
      </div>

      <form onSubmit={handleSubmit} className="form-grid">
        <label className="field">
          <span>Cliente (opcional — usa "Consumidor Final" si está configurado)</span>
          <EntityAutocomplete
            entityType="customer"
            items={customers}
            getId={(c) => c.id}
            getLabel={(c) => c.name}
            getSearchText={(c) => c.name}
            value={customerId}
            onChange={setCustomerId}
            placeholder="Buscar cliente…"
          />
        </label>

        <div style={{ gridColumn: '1 / -1' }}>
          <p className="text-muted" style={{ marginBottom: 8 }}>
            Productos
          </p>
          {lines.map((line, index) => {
            const variant = variants.find((v) => v.id === line.variantId);
            return (
              <div key={index} className="btn-row" style={{ alignItems: 'flex-end', marginBottom: 8, flexWrap: 'wrap' }}>
                <label className="field" style={{ minWidth: 220 }}>
                  <span>Producto</span>
                  <EntityAutocomplete
                    entityType="product"
                    items={variants}
                    getId={(v) => v.id}
                    getLabel={(v) => `${v.productName} (${v.sku})${v.isService ? ' — servicio' : ''}`}
                    getSearchText={(v) => `${v.productName} ${v.sku}`}
                    value={line.variantId}
                    onChange={(id) => updateLine(index, { variantId: id })}
                    placeholder="Buscar producto…"
                  />
                </label>
                {variant && !variant.isService && (
                  <label className="field" style={{ width: 160 }}>
                    <span>Almacén</span>
                    <select value={line.warehouseId} onChange={(e) => updateLine(index, { warehouseId: e.target.value })} required>
                      <option value="">Elige uno</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="field" style={{ width: 90 }}>
                  <span>Cantidad</span>
                  <input type="number" min="0.0001" step="0.0001" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })} required />
                </label>
                <label className="field" style={{ width: 110 }}>
                  <span>Precio unitario</span>
                  <input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(index, { unitPrice: e.target.value })} required />
                </label>
                {lines.length > 1 && (
                  <button type="button" className="btn btn-small" onClick={() => removeLine(index)}>
                    Quitar
                  </button>
                )}
              </div>
            );
          })}
          <button type="button" className="btn btn-small" onClick={addLine}>
            + Agregar producto
          </button>
        </div>

        <label className="field">
          <span>
            Jurisdicción fiscal <HelpTooltip text="Determina qué impuesto/retención aplica. Se preselecciona sola con la primera disponible." />
          </span>
          <select value={jurisdictionId} onChange={(e) => setJurisdictionId(e.target.value)} required>
            {jurisdictions.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Cuenta de ingreso</span>
          <select value={incomeAccountId} onChange={(e) => setIncomeAccountId(e.target.value)} required>
            {incomeAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} · {a.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field" style={{ gridColumn: '1 / -1', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={collectNow} onChange={(e) => setCollectNow(e.target.checked)} />
          <span>Cobrar de inmediato</span>
        </label>

        {collectNow && (
          <>
            <label className="field">
              <span>Cuenta de tesorería</span>
              <select value={treasuryAccountId} onChange={(e) => setTreasuryAccountId(e.target.value)} required={collectNow}>
                {treasuryAccounts.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Método de pago</span>
              <select value={paymentMethodId} onChange={(e) => setPaymentMethodId(e.target.value)}>
                <option value="">Sin especificar</option>
                {paymentMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Monto cobrado (vacío = el total)</span>
              <input type="number" min="0" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} placeholder={total.toFixed(2)} />
            </label>
          </>
        )}

        <p className="text-muted" style={{ gridColumn: '1 / -1' }}>
          Total: <strong>{formatCurrency(total)}</strong>
        </p>

        {formError && (
          <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>
            {formError}
          </p>
        )}

        <button type="submit" className="btn btn-primary" disabled={isSaving} style={{ gridColumn: '1 / -1', justifySelf: 'start' }}>
          {isSaving ? 'Registrando…' : 'Registrar venta'}
        </button>
      </form>

      {lastResult && (
        <p className="alert-box alert-box-success" style={{ marginTop: 16 }}>
          Factura N.º {lastResult.invoice.invoiceNumber} registrada por {formatCurrency(lastResult.invoice.totalAmount)}
          {lastResult.payment ? `, cobrada por ${formatCurrency(lastResult.payment.amount)}.` : '.'}
        </p>
      )}
    </div>
  );
}
