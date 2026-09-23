import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { customersApi, arCollectionsApi } from '../../api/ar';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatCurrency } from '../../utils/format';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';
import ImportWizard from '../../core/ui/ImportWizard';
import ConditionalField from '../../core/ui/ConditionalField';
import ValidatedField from '../../core/ui/ValidatedField';
import FormField, { RequiredFieldsNote } from '../../core/ui/FormField';
import { evaluateCondition } from '../../utils/conditionEvaluator';
import { validateThousandsAmount } from '../../utils/fieldValidators';

const CUSTOMER_IMPORT_FIELDS = [
  { key: 'name', label: 'Nombre', type: 'text', required: true },
  { key: 'taxId', label: 'NIT / Cédula', type: 'text' },
  { key: 'email', label: 'Correo', type: 'text' },
  { key: 'phone', label: 'Teléfono', type: 'text' },
  { key: 'paymentTermsDays', label: 'Días para pagar', type: 'number' },
  { key: 'creditLimit', label: 'Límite de crédito', type: 'number' },
  { key: 'maxOverdueDaysAllowed', label: 'Máximo de días de atraso permitido', type: 'number' },
];

// Configuración centralizada de campos condicionales de este
// formulario (mismo criterio que Inventario > Catálogo).
const CUSTOMER_FIELD_VISIBILITY = {
  billingCurrency: { field: 'isForeign', op: 'eq', value: true },
};

const EMPTY_FORM = {
  name: '',
  taxId: '',
  email: '',
  phone: '',
  paymentTermsDays: 30,
  creditLimit: '',
  maxOverdueDaysAllowed: '',
  isForeign: false,
  billingCurrency: '',
};

export default function CustomersPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'COLLABORATOR';
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [rowErrors, setRowErrors] = useState({});

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [blockingId, setBlockingId] = useState(null);
  const [blockReason, setBlockReason] = useState('');

  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [scanError, setScanError] = useState('');

  const [isImportOpen, setIsImportOpen] = useState(false);

  // Botón flotante de creación rápida: si se llegó acá desde "Nuevo
  // cliente" en ese menú, el formulario se abre solo.
  useEffect(() => {
    if (location.state?.autoOpenCreate) {
      setIsFormOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  async function handleScanCollections() {
    setIsScanning(true);
    setScanMessage('');
    setScanError('');
    try {
      const result = await arCollectionsApi.scan();
      setScanMessage(
        result.alertsCreated > 0
          ? `Se generaron ${result.alertsCreated} alerta(s) de cobranza nuevas — revísalas en Tesorería › Alertas.`
          : 'No hay clientes con atraso nuevo por avisar.'
      );
    } catch (err) {
      setScanError(err instanceof ApiError ? err.message : 'No se pudo escanear la cobranza.');
    } finally {
      setIsScanning(false);
    }
  }

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const data = await customersApi.list();
      setCustomers(data);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar los clientes.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  async function handleCreate(event) {
    event.preventDefault();
    setFormError('');
    if (!validateThousandsAmount(form.creditLimit).valid) {
      setFormError('Corrige el formato del límite de crédito antes de guardar.');
      return;
    }
    if (form.isForeign && !form.billingCurrency.trim()) {
      setFormError('Indica la moneda de facturación de este cliente extranjero.');
      return;
    }
    setIsSaving(true);
    try {
      const created = await customersApi.create({
        name: form.name,
        taxId: form.taxId || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        paymentTermsDays: form.paymentTermsDays ? Number(form.paymentTermsDays) : undefined,
        creditLimit: form.creditLimit === '' ? undefined : Number(form.creditLimit),
        maxOverdueDaysAllowed: form.maxOverdueDaysAllowed === '' ? undefined : Number(form.maxOverdueDaysAllowed),
        isForeign: form.isForeign,
        billingCurrency: form.isForeign && form.billingCurrency ? form.billingCurrency.toUpperCase() : undefined,
      });
      setForm(EMPTY_FORM);
      setIsFormOpen(false);
      await loadCustomers();
      // Siguiente paso lógico evidente tras crear un cliente (innovación
      // pedida explícitamente): ofrecer facturarle de una vez, sin
      // obligar a navegar a Facturas de Venta y volver a buscarlo.
      showToast({
        message: `Cliente "${created.name}" creado.`,
        actionLabel: 'Crear factura para este cliente',
        onAction: () => navigate('/cuentas/facturas-venta', { state: { presetCustomerId: created.id } }),
      });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear el cliente.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleBlock(customer) {
    setRowErrors((prev) => ({ ...prev, [customer.id]: '' }));
    if (!blockReason.trim()) {
      setRowErrors((prev) => ({ ...prev, [customer.id]: 'Debes indicar el motivo del bloqueo.' }));
      return;
    }
    try {
      await customersApi.block(customer.id, blockReason);
      setBlockingId(null);
      setBlockReason('');
      await loadCustomers();
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [customer.id]: err instanceof ApiError ? err.message : 'No se pudo bloquear al cliente.',
      }));
    }
  }

  async function handleUnblock(customer) {
    setRowErrors((prev) => ({ ...prev, [customer.id]: '' }));
    try {
      await customersApi.unblock(customer.id);
      await loadCustomers();
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [customer.id]: err instanceof ApiError ? err.message : 'No se pudo desbloquear al cliente.',
      }));
    }
  }

  // Fase 2 (maestros): el backend y el cliente HTTP ya tenían el
  // endpoint de actualización, pero esta pantalla nunca ofrecía un
  // botón para activar/desactivar un cliente (solo bloquear/desbloquear,
  // un concepto distinto: crédito vencido vs. dejó de operar con
  // nosotros) — mismo patrón ya usado en VendorsPage.
  async function handleToggleActive(customer) {
    setRowErrors((prev) => ({ ...prev, [customer.id]: '' }));
    try {
      await customersApi.update(customer.id, { isActive: !customer.isActive });
      await loadCustomers();
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [customer.id]: err instanceof ApiError ? err.message : 'No se pudo actualizar el cliente.',
      }));
    }
  }

  return (
    <div className="page">
      <div className="panel">
        <div className="panel-header">
          <h2 className="field-label">
            Clientes
            <HelpTooltip text="El escaneo de cobranza revisa las facturas vencidas de todos los clientes y genera avisos según cuántos días de atraso llevan: recordatorio, aviso firme, o bloqueo automático si el atraso es grave." />
          </h2>
          <div className="btn-row">
            {canManage && (
              <button type="button" className="btn btn-small" onClick={handleScanCollections} disabled={isScanning}>
                {isScanning ? 'Escaneando…' : 'Escanear cobranza atrasada'}
              </button>
            )}
            {canManage && (
              <button type="button" className="btn btn-small" onClick={() => setIsImportOpen(true)}>
                Importar clientes
              </button>
            )}
            {canManage && (
              <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFormOpen((v) => !v)}>
                {isFormOpen ? 'Cancelar' : '+ Nuevo cliente'}
              </button>
            )}
          </div>
        </div>

        {scanMessage && <p className="alert-box alert-box-success" style={{ marginBottom: 16 }}>{scanMessage}</p>}
        {scanError && <p className="alert-box alert-box-error" style={{ marginBottom: 16 }}>{scanError}</p>}

        {canManage && isFormOpen && (
          <form onSubmit={handleCreate} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
            <div className="form-grid">
              <FormField label="Nombre" required>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </FormField>
              <FormField label="NIT / Cédula">
                <input value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} />
              </FormField>
              <FormField label="Correo">
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </FormField>
              <FormField label="Teléfono">
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </FormField>
              <FormField
                label="Días para pagar"
                help="Cuántos días después de emitida una factura se considera su fecha de vencimiento."
              >
                <input
                  type="number"
                  min={1}
                  value={form.paymentTermsDays}
                  onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })}
                />
              </FormField>
              <ValidatedField
                label="Límite de crédito (opcional)"
                help={<HelpTooltip text="El monto máximo que este cliente puede deber en total. Si se supera al crear una factura nueva, el sistema la rechaza. Déjalo vacío si no quieres poner límite." />}
                value={form.creditLimit}
                onChange={(creditLimit) => setForm({ ...form, creditLimit })}
                validate={validateThousandsAmount}
                inputMode="decimal"
              />
              <FormField
                label="Máximo de días de atraso permitido"
                help="Si el cliente tiene una factura más atrasada que este número de días, no se le podrán crear facturas nuevas hasta que se ponga al día."
              >
                <input
                  type="number"
                  min={1}
                  value={form.maxOverdueDaysAllowed}
                  onChange={(e) => setForm({ ...form, maxOverdueDaysAllowed: e.target.value })}
                />
              </FormField>
              <FormField
                label="Cliente extranjero"
                checkbox
                help="Actívalo si este cliente está fuera del país — al hacerlo aparece el campo para indicar en qué moneda se le factura."
              >
                <input type="checkbox" checked={form.isForeign} onChange={(e) => setForm({ ...form, isForeign: e.target.checked })} />
              </FormField>
            </div>

            <ConditionalField show={evaluateCondition(CUSTOMER_FIELD_VISIBILITY.billingCurrency, form)}>
              <div className="form-grid">
                <FormField label="Moneda de facturación" required={form.isForeign}>
                  <input
                    value={form.billingCurrency}
                    onChange={(e) => setForm({ ...form, billingCurrency: e.target.value.toUpperCase() })}
                    maxLength={3}
                    placeholder="USD"
                  />
                </FormField>
              </div>
            </ConditionalField>

            <RequiredFieldsNote />

            {formError && (
              <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
                {formError}
              </p>
            )}
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Guardando…' : 'Crear cliente'}
              </button>
            </div>
          </form>
        )}

        {isLoading && <p className="text-muted">Cargando…</p>}
        {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
        {!isLoading && !loadError && customers.length === 0 && (
          <EmptyState icon="●" message="Todavía no registraste ningún cliente." />
        )}
        {!isLoading && !loadError && customers.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>NIT / Cédula</th>
                <th>Días para pagar</th>
                <th className="num">Límite de crédito</th>
                <th>Estado</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.taxId || '—'}</td>
                  <td>{c.paymentTermsDays}</td>
                  <td className="num">{c.creditLimit != null ? formatCurrency(c.creditLimit) : 'Sin límite'}</td>
                  <td>
                    {c.isBlocked ? (
                      <StatusSeal status="rejected" label="Bloqueado" />
                    ) : (
                      <StatusSeal status={c.isActive ? 'active' : 'inactive'} label={c.isActive ? 'Activo' : 'Inactivo'} />
                    )}
                  </td>
                  {canManage && (
                    <td>
                      {!c.isBlocked && blockingId !== c.id && (
                        <button type="button" className="btn btn-small btn-danger" onClick={() => setBlockingId(c.id)}>
                          Bloquear
                        </button>
                      )}
                      {!c.isBlocked && blockingId === c.id && (
                        <div className="btn-row">
                          <input
                            placeholder="Motivo del bloqueo"
                            value={blockReason}
                            onChange={(e) => setBlockReason(e.target.value)}
                            style={{
                              background: 'var(--color-bg)',
                              border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-sm)',
                              padding: '6px 9px',
                            }}
                          />
                          <button type="button" className="btn btn-small btn-primary" onClick={() => handleBlock(c)}>
                            Confirmar
                          </button>
                          <button
                            type="button"
                            className="btn btn-small"
                            onClick={() => {
                              setBlockingId(null);
                              setBlockReason('');
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                      {c.isBlocked && (
                        <button type="button" className="btn btn-small" onClick={() => handleUnblock(c)}>
                          Desbloquear
                        </button>
                      )}
                      {!c.isBlocked && blockingId !== c.id && (
                        <button type="button" className="btn btn-small" style={{ marginLeft: 6 }} onClick={() => handleToggleActive(c)}>
                          {c.isActive ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                      {rowErrors[c.id] && (
                        <p className="alert-box alert-box-error" style={{ marginTop: 6 }}>
                          {rowErrors[c.id]}
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

      {isImportOpen && (
        <ImportWizard
          targetKey="ar-customers"
          targetLabel="clientes"
          fields={CUSTOMER_IMPORT_FIELDS}
          onImport={(rows) => customersApi.import(rows)}
          onImported={loadCustomers}
          onClose={() => setIsImportOpen(false)}
        />
      )}
    </div>
  );
}
