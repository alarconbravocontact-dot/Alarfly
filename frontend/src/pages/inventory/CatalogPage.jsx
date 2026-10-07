import { useCallback, useEffect, useRef, useState } from 'react';
import { productsApi, productCategoriesApi, unitsOfMeasureApi } from '../../api/inventory';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';
import ConditionalField from '../../core/ui/ConditionalField';
import { evaluateCondition } from '../../utils/conditionEvaluator';
import RecordDrawer from '../../core/ui/RecordDrawer';

const VALUATION_LABELS = { FIFO: 'FIFO', LIFO: 'LIFO', WEIGHTED_AVERAGE: 'Promedio ponderado' };

// Configuración centralizada de qué campos mostrar según selecciones
// previas — un solo lugar por formulario, en vez de if/else repetido
// junto a cada campo. Se evalúa con el mismo evaluador seguro que ya
// usa el constructor de filtros (utils/conditionEvaluator.js).
const PRODUCT_FIELD_VISIBILITY = {
  physicalInventoryFields: { field: 'isService', op: 'neq', value: true },
};

const EMPTY_PRODUCT_FORM = {
  sku: '',
  name: '',
  description: '',
  categoryId: '',
  valuationMethod: '',
  baseUnitOfMeasureId: '',
  isService: false,
  trackLots: false,
  trackExpiration: false,
  minStock: '',
  maxStock: '',
};

export default function CatalogPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // Detalle contextual (drawer): ver las variantes de un producto NO
  // navega a otra pantalla ni reinicia la lista.
  const [selectedProductId, setSelectedProductId] = useState(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_PRODUCT_FORM);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [variantForms, setVariantForms] = useState({});
  const [rowErrors, setRowErrors] = useState({});

  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [unitCode, setUnitCode] = useState('');
  const [unitName, setUnitName] = useState('');
  const [setupError, setSetupError] = useState('');

  // F17-E2: bug real encontrado con una empresa recién creada — el
  // formulario de "Nuevo producto" siempre estaba visible, pero el
  // selector de "Unidad de medida base" quedaba sin ninguna opción
  // real (solo el placeholder) mientras el panel donde se crea una
  // unidad seguía colapsado ("Mostrar") arriba, sin ninguna pista de
  // que había que abrirlo primero — un callejón sin salida para el
  // primer producto. Se abre solo una vez, automáticamente, la
  // primera vez que la carga inicial confirma que no existe ninguna
  // unidad de medida — nunca se vuelve a forzar después (el usuario
  // puede cerrarlo y no reabrirse solo en cada refresco posterior).
  const hasAutoOpenedSetup = useRef(false);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [productsData, categoriesData, unitsData] = await Promise.all([
        productsApi.list(),
        productCategoriesApi.list(),
        unitsOfMeasureApi.list(),
      ]);
      setProducts(productsData);
      setCategories(categoriesData);
      setUnits(unitsData);
      if (!hasAutoOpenedSetup.current && unitsData.length === 0) {
        hasAutoOpenedSetup.current = true;
        setIsSetupOpen(true);
      }
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar el catálogo.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleCreateCategory(event) {
    event.preventDefault();
    setSetupError('');
    try {
      await productCategoriesApi.create({ name: categoryName });
      setCategoryName('');
      await loadAll();
    } catch (err) {
      setSetupError(err instanceof ApiError ? err.message : 'No se pudo crear la categoría.');
    }
  }

  async function handleCreateUnit(event) {
    event.preventDefault();
    setSetupError('');
    try {
      await unitsOfMeasureApi.create({ code: unitCode, name: unitName });
      setUnitCode('');
      setUnitName('');
      await loadAll();
    } catch (err) {
      setSetupError(err instanceof ApiError ? err.message : 'No se pudo crear la unidad de medida.');
    }
  }

  async function handleCreateProduct(event) {
    event.preventDefault();
    setFormError('');
    setIsSaving(true);
    try {
      await productsApi.create({
        sku: form.sku,
        name: form.name,
        description: form.description || undefined,
        categoryId: form.categoryId || undefined,
        valuationMethod: form.valuationMethod || undefined,
        baseUnitOfMeasureId: form.baseUnitOfMeasureId,
        isService: form.isService,
        trackLots: form.isService ? false : form.trackLots,
        trackExpiration: form.isService ? false : form.trackExpiration,
        minStock: form.isService || form.minStock === '' ? undefined : Number(form.minStock),
        maxStock: form.isService || form.maxStock === '' ? undefined : Number(form.maxStock),
      });
      setForm(EMPTY_PRODUCT_FORM);
      setIsFormOpen(false);
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear el producto.');
    } finally {
      setIsSaving(false);
    }
  }

  const selectedProduct = selectedProductId ? products.find((p) => p.id === selectedProductId) : null;

  function openProductDetail(product) {
    setSelectedProductId(product.id);
  }

  function closeProductDetail() {
    setSelectedProductId(null);
  }

  function navigateProductDetail(delta) {
    const index = products.findIndex((p) => p.id === selectedProductId);
    if (index === -1) return;
    const next = products[index + delta];
    if (next) setSelectedProductId(next.id);
  }

  // Fase 2 (maestros): el backend y el cliente HTTP ya tenían el
  // endpoint de actualización (usado para editar cuentas/proveedor
  // preferido), pero esta pantalla nunca ofrecía un botón para
  // activar/desactivar un producto — mismo patrón ya usado en
  // VendorsPage.
  async function handleToggleProductActive(product) {
    setRowErrors((prev) => ({ ...prev, [product.id]: '' }));
    try {
      await productsApi.update(product.id, { isActive: !product.isActive });
      await loadAll();
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [product.id]: err instanceof ApiError ? err.message : 'No se pudo actualizar el producto.',
      }));
    }
  }

  function updateVariantForm(productId, changes) {
    setVariantForms((prev) => ({ ...prev, [productId]: { ...(prev[productId] || { sku: '' }), ...changes } }));
  }

  async function handleAddVariant(product) {
    const variantForm = variantForms[product.id];
    if (!variantForm?.sku) return;
    try {
      await productsApi.addVariant(product.id, { sku: variantForm.sku });
      setVariantForms((prev) => ({ ...prev, [product.id]: { sku: '' } }));
      await loadAll();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo agregar la variante.');
    }
  }

  return (
    <div className="page">
      {canManage && (
        <div className="panel">
          <div className="panel-header">
            <h2>Categorías y unidades de medida</h2>
            <button type="button" className="btn btn-small" onClick={() => setIsSetupOpen((v) => !v)}>
              {isSetupOpen ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          {isSetupOpen && (
            <div className="form-grid">
              <form onSubmit={handleCreateCategory} className="btn-row" style={{ alignItems: 'center' }}>
                <input
                  placeholder="Nombre de categoría"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  required
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '6px 9px' }}
                />
                <button type="submit" className="btn btn-small btn-primary">
                  + Categoría
                </button>
              </form>
              <form onSubmit={handleCreateUnit} className="btn-row" style={{ alignItems: 'center' }}>
                <input
                  placeholder="Código (ej. UND)"
                  value={unitCode}
                  onChange={(e) => setUnitCode(e.target.value)}
                  required
                  style={{ width: 100, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '6px 9px' }}
                />
                <input
                  placeholder="Nombre (ej. Unidad)"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  required
                  style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '6px 9px' }}
                />
                <button type="submit" className="btn btn-small btn-primary">
                  + Unidad de medida
                </button>
              </form>
              {setupError && <p className="alert-box alert-box-error" style={{ gridColumn: '1 / -1' }}>{setupError}</p>}
              <p className="text-muted" style={{ gridColumn: '1 / -1' }}>
                Categorías: {categories.map((c) => c.name).join(', ') || 'ninguna'} · Unidades:{' '}
                {units.map((u) => u.code).join(', ') || 'ninguna'}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Productos</h2>
          {canManage && (
            <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFormOpen((v) => !v)}>
              {isFormOpen ? 'Cancelar' : '+ Nuevo producto'}
            </button>
          )}
        </div>

        {canManage && isFormOpen && (
          <form onSubmit={handleCreateProduct} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
            <div className="form-grid">
              <label className="field">
                <span>SKU</span>
                <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
              </label>
              <label className="field">
                <span>Nombre</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </label>
              <label className="field">
                <span>Categoría (opcional)</span>
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  <option value="">Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Unidad de medida base</span>
                <select value={form.baseUnitOfMeasureId} onChange={(e) => setForm({ ...form, baseUnitOfMeasureId: e.target.value })} required>
                  <option value="">Selecciona una unidad</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.code} · {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field-label">
                  Método de valoración (opcional)
                  <HelpTooltip text="Cómo se calcula el costo del inventario cuando sale una unidad. FIFO: sale primero lo que entró primero. LIFO: sale primero lo que entró último. Promedio ponderado: se usa el costo promedio de todo lo que hay en stock. Si no eliges uno, se usa el de la categoría o el general de la empresa." />
                </span>
                <select value={form.valuationMethod} onChange={(e) => setForm({ ...form, valuationMethod: e.target.value })}>
                  <option value="">Usar el de la categoría / general</option>
                  <option value="FIFO">FIFO</option>
                  <option value="LIFO">LIFO</option>
                  <option value="WEIGHTED_AVERAGE">Promedio ponderado</option>
                </select>
              </label>
              <label className="field field-checkbox">
                <input type="checkbox" checked={form.isService} onChange={(e) => setForm({ ...form, isService: e.target.checked })} />
                <span className="field-label">
                  Es un servicio (sin inventario físico)
                  <HelpTooltip text="Actívalo si esto no es algo que se guarda en un almacén (ej. una consultoría, una hora de mano de obra). Al activarlo se ocultan los campos de stock, porque no aplican." />
                </span>
              </label>
            </div>

            <ConditionalField show={evaluateCondition(PRODUCT_FIELD_VISIBILITY.physicalInventoryFields, form)}>
              <div className="form-grid">
                <label className="field">
                  <span>Stock mínimo (opcional)</span>
                  <input type="number" min="0" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
                </label>
                <label className="field">
                  <span>Stock máximo (opcional)</span>
                  <input type="number" min="0" value={form.maxStock} onChange={(e) => setForm({ ...form, maxStock: e.target.value })} />
                </label>
                <label className="field field-checkbox">
                  <input type="checkbox" checked={form.trackLots} onChange={(e) => setForm({ ...form, trackLots: e.target.checked })} />
                  <span className="field-label">
                    Rastrear lotes
                    <HelpTooltip text="Actívalo si necesitas saber en qué lote o serie llegó cada unidad de este producto (útil para trazabilidad)." />
                  </span>
                </label>
                <label className="field field-checkbox">
                  <input
                    type="checkbox"
                    checked={form.trackExpiration}
                    onChange={(e) => setForm({ ...form, trackExpiration: e.target.checked })}
                  />
                  <span className="field-label">
                    Rastrear vencimiento
                    <HelpTooltip text="Actívalo si este producto puede vencer, para recibir alertas antes de que se venza el stock." />
                  </span>
                </label>
              </div>
            </ConditionalField>

            <div className="form-grid">
              <label className="field" style={{ gridColumn: 'span 2' }}>
                <span>Descripción (opcional)</span>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </label>
            </div>
            {formError && <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>{formError}</p>}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Crear producto'}
              </button>
            </div>
          </form>
        )}

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && products.length === 0 && (
          <EmptyState
            icon="●"
            message="Todavía no creaste ningún producto — sin al menos uno, no puedes registrar una venta ni controlar tu stock."
            actionLabel={canManage ? '+ Nuevo producto' : undefined}
            onAction={canManage ? () => setIsFormOpen(true) : undefined}
          />
        )}
        {!isLoading && !loadError && products.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Valoración</th>
                <th>Estado</th>
                <th></th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.sku}</td>
                  <td>{p.name}</td>
                  <td>{p.category?.name || '—'}</td>
                  <td>{p.valuationMethod ? VALUATION_LABELS[p.valuationMethod] : 'Heredado'}</td>
                  <td>
                    <StatusSeal status={p.isActive ? 'active' : 'inactive'} label={p.isActive ? 'Activo' : 'Inactivo'} />
                  </td>
                  <td>
                    <button type="button" className="btn btn-small" onClick={() => openProductDetail(p)}>
                      Ver variantes
                    </button>
                  </td>
                  {canManage && (
                    <td>
                      <button type="button" className="btn btn-small" onClick={() => handleToggleProductActive(p)}>
                        {p.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                      {rowErrors[p.id] && (
                        <p className="alert-box alert-box-error" style={{ marginTop: 6 }}>
                          {rowErrors[p.id]}
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

      <RecordDrawer
        isOpen={Boolean(selectedProduct)}
        onClose={closeProductDetail}
        title={selectedProduct ? `${selectedProduct.sku} · ${selectedProduct.name}` : ''}
        subtitle={selectedProduct ? 'Variantes' : ''}
        onNavigate={navigateProductDetail}
        hasPrev={products.findIndex((p) => p.id === selectedProductId) > 0}
        hasNext={
          products.findIndex((p) => p.id === selectedProductId) !== -1 &&
          products.findIndex((p) => p.id === selectedProductId) < products.length - 1
        }
        summary={
          selectedProduct && (
            <div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SKU de variante</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProduct.variants.map((v) => (
                    <tr key={v.id}>
                      <td>{v.sku}</td>
                      <td>
                        <StatusSeal status={v.isActive ? 'active' : 'inactive'} label={v.isActive ? 'Activa' : 'Inactiva'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {canManage && (
                <div className="btn-row" style={{ marginTop: 12, alignItems: 'center' }}>
                  <input
                    placeholder="SKU de la nueva variante"
                    value={variantForms[selectedProduct.id]?.sku || ''}
                    onChange={(e) => updateVariantForm(selectedProduct.id, { sku: e.target.value })}
                    style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', padding: '6px 9px' }}
                  />
                  <button type="button" className="btn btn-small" onClick={() => handleAddVariant(selectedProduct)}>
                    + Agregar variante
                  </button>
                </div>
              )}
            </div>
          )
        }
      />
    </div>
  );
}
