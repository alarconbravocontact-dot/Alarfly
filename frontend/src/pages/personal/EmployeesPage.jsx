import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { employeesApi } from '../../api/personal';
import { dimensionsApi } from '../../api/accounting';
import { fpaDimensionsApi } from '../../api/fpa';
import { ApiError } from '../../api/client';
import { formatCurrency, formatDate } from '../../utils/format';
import { useToast } from '../../context/ToastContext';
import HelpTooltip from '../../components/HelpTooltip';
import StatusSeal from '../../core/ui/StatusSeal';
import EmptyState from '../../core/ui/EmptyState';
import FormField, { RequiredFieldsNote } from '../../core/ui/FormField';
import RecordDrawer from '../../core/ui/RecordDrawer';
import DocumentTimeline from '../../core/ui/DocumentTimeline';
import '../../core/ui/RecordLink.css';

const EMPLOYMENT_TYPE_LABELS = { FULL_TIME: 'Tiempo completo', PART_TIME: 'Medio tiempo', CONTRACTOR: 'Contratista', OTHER: 'Otro' };
const PAY_FREQUENCY_LABELS = { MONTHLY: 'Mensual', BIWEEKLY: 'Quincenal', WEEKLY: 'Semanal' };

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  documentId: '',
  email: '',
  phone: '',
  address: '',
  position: '',
  employmentType: 'FULL_TIME',
  hireDate: '',
  branchDimensionId: '',
  fpaDimensionId: '',
  supervisorId: '',
  baseSalary: '',
  currency: 'USD',
  payFrequency: 'MONTHLY',
  paymentMethodNote: '',
};

export default function EmployeesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [fichaEmployeeId, setFichaEmployeeId] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [fichaError, setFichaError] = useState('');

  useEffect(() => {
    if (location.state?.autoOpenCreate) {
      setIsFormOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const [employeeList, branchList, departmentList] = await Promise.all([
        employeesApi.list(),
        dimensionsApi.list('BRANCH'),
        fpaDimensionsApi.list(),
      ]);
      setEmployees(employeeList);
      setBranches(branchList);
      // El catálogo de FP&A trae los 6 tipos de dimensión (incluye
      // PRODUCT/CLIENT, que no tienen sentido para un empleado) — se
      // filtra a los dos que sí aplican, sin pedirle al backend un
      // filtro por "uno de varios tipos" que hoy no soporta.
      setDepartments(departmentList.filter((d) => d.type === 'DEPARTMENT' || d.type === 'COST_CENTER'));
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar el personal.');
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
    if (!form.hireDate) {
      setFormError('Indica la fecha de ingreso.');
      return;
    }
    setIsSaving(true);
    try {
      const created = await employeesApi.create({
        ...form,
        documentId: form.documentId || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        branchDimensionId: form.branchDimensionId || undefined,
        fpaDimensionId: form.fpaDimensionId || undefined,
        supervisorId: form.supervisorId || undefined,
        paymentMethodNote: form.paymentMethodNote || undefined,
        baseSalary: Number(form.baseSalary),
      });
      setForm(EMPTY_FORM);
      setIsFormOpen(false);
      await loadAll();
      showToast({
        message: `Empleado "${created.firstName} ${created.lastName}" creado.`,
        actionLabel: 'Calcular una nómina',
        onAction: () => navigate('/personal/nomina'),
      });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'No se pudo crear el empleado.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(employee) {
    try {
      await employeesApi.update(employee.id, { status: employee.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
      await loadAll();
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo actualizar el empleado.');
    }
  }

  function openFicha(employeeId) {
    setFichaEmployeeId(employeeId);
    setFicha(null);
    setFichaError('');
    employeesApi
      .getFicha(employeeId)
      .then(setFicha)
      .catch((err) => setFichaError(err instanceof ApiError ? err.message : 'No se pudo cargar la ficha.'));
  }

  const activeEmployeesForSupervisor = employees.filter((e) => e.status === 'ACTIVE');

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="field-label">Personal</h2>
        <button type="button" className="btn btn-primary btn-small" onClick={() => setIsFormOpen((v) => !v)}>
          {isFormOpen ? 'Cancelar' : '+ Nuevo empleado'}
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleCreate} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)' }}>
          <h3 className="field-label">Identificación</h3>
          <div className="form-grid">
            <FormField label="Nombre" required>
              <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </FormField>
            <FormField label="Apellido" required>
              <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </FormField>
            <FormField label="Documento de identidad">
              <input value={form.documentId} onChange={(e) => setForm({ ...form, documentId: e.target.value })} />
            </FormField>
            <FormField label="Correo">
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </FormField>
            <FormField label="Teléfono">
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </FormField>
            <FormField label="Dirección">
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </FormField>
          </div>

          <h3 className="field-label" style={{ marginTop: 16 }}>
            Información laboral
          </h3>
          <div className="form-grid">
            <FormField label="Cargo" required>
              <input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
            </FormField>
            <FormField label="Tipo de relación laboral">
              <select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
                {Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Fecha de ingreso" required>
              <input type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} />
            </FormField>
            <FormField
              label="Sucursal"
              help={<HelpTooltip text="La sucursal/sede donde trabaja este empleado — se usa para ver el costo de personal por sucursal en los reportes." />}
            >
              <select value={form.branchDimensionId} onChange={(e) => setForm({ ...form, branchDimensionId: e.target.value })}>
                <option value="">Sin indicar</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Departamento / Centro de costo"
              help={<HelpTooltip text="Para poder ver cuánto cuesta el personal de cada departamento. Se crean y administran en FP&A > Dimensiones." />}
            >
              <select value={form.fpaDimensionId} onChange={(e) => setForm({ ...form, fpaDimensionId: e.target.value })}>
                <option value="">Sin indicar</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Supervisor">
              <select value={form.supervisorId} onChange={(e) => setForm({ ...form, supervisorId: e.target.value })}>
                <option value="">Sin indicar</option>
                {activeEmployeesForSupervisor.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <h3 className="field-label" style={{ marginTop: 16 }}>
            Información económica
          </h3>
          <div className="form-grid">
            <FormField label="Salario base" required>
              <input type="number" min={0} step="0.01" value={form.baseSalary} onChange={(e) => setForm({ ...form, baseSalary: e.target.value })} />
            </FormField>
            <FormField label="Moneda" required>
              <input value={form.currency} maxLength={3} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
            </FormField>
            <FormField label="Frecuencia de pago">
              <select value={form.payFrequency} onChange={(e) => setForm({ ...form, payFrequency: e.target.value })}>
                {Object.entries(PAY_FREQUENCY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Cuenta o método de pago" help="Solo informativo — el pago real se registra desde Tesorería al pagar la nómina.">
              <input value={form.paymentMethodNote} onChange={(e) => setForm({ ...form, paymentMethodNote: e.target.value })} />
            </FormField>
          </div>

          <RequiredFieldsNote />
          {formError && (
            <p className="alert-box alert-box-error" style={{ marginTop: 12 }}>
              {formError}
            </p>
          )}
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Guardando…' : 'Crear empleado'}
            </button>
          </div>
        </form>
      )}

      {isLoading && <p className="text-muted">Cargando…</p>}
      {!isLoading && loadError && <p className="alert-box alert-box-error">{loadError}</p>}
      {!isLoading && !loadError && employees.length === 0 && (
        <EmptyState
          icon="●"
          message="Todavía no registraste a nadie — crea el primer empleado para empezar a llevar su nómina y sus gastos."
          actionLabel="+ Nuevo empleado"
          onAction={() => setIsFormOpen(true)}
        />
      )}
      {!isLoading && !loadError && employees.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Cargo</th>
              <th>Sucursal</th>
              <th>Departamento</th>
              <th className="num">Salario</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id}>
                <td>
                  <button type="button" className="record-link" onClick={() => openFicha(employee.id)}>
                    {employee.firstName} {employee.lastName}
                  </button>
                </td>
                <td>{employee.position}</td>
                <td>{employee.branchDimension?.name || '—'}</td>
                <td>{employee.fpaDimension?.name || '—'}</td>
                <td className="num">{formatCurrency(employee.baseSalary, employee.currency)}</td>
                <td>
                  <StatusSeal status={employee.status === 'ACTIVE' ? 'active' : 'inactive'} label={employee.status === 'ACTIVE' ? 'Activo' : 'Inactivo'} />
                </td>
                <td>
                  <div className="btn-row">
                    <button type="button" className="btn btn-small" onClick={() => openFicha(employee.id)}>
                      Ver ficha
                    </button>
                    <button type="button" className="btn btn-small" onClick={() => handleToggleActive(employee)}>
                      {employee.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <RecordDrawer
        isOpen={fichaEmployeeId !== null}
        onClose={() => setFichaEmployeeId(null)}
        title={ficha ? `${ficha.employee.firstName} ${ficha.employee.lastName}` : 'Ficha del empleado'}
        subtitle={ficha ? ficha.employee.position : undefined}
        summary={<EmployeeFichaSummary ficha={ficha} error={fichaError} />}
        fullDetail={<EmployeeFichaFull ficha={ficha} error={fichaError} />}
      />
    </div>
  );
}

function EmployeeFichaSummary({ ficha, error }) {
  if (error) return <p className="alert-box alert-box-error">{error}</p>;
  if (!ficha) return <p className="text-muted">Cargando…</p>;
  const { summary } = ficha;
  return (
    <div className="form-grid">
      <FichaStat label="Estado" value={<StatusSeal status={summary.status === 'ACTIVE' ? 'active' : 'inactive'} label={summary.status === 'ACTIVE' ? 'Activo' : 'Inactivo'} />} />
      <FichaStat label="Fecha de ingreso" value={formatDate(new Date(summary.hireDate))} />
      <FichaStat label="Salario actual" value={formatCurrency(summary.currentSalary, summary.currency)} />
      <FichaStat
        label="Última nómina"
        value={summary.lastPayroll ? `${summary.lastPayroll.label} — ${formatCurrency(summary.lastPayroll.netPay, summary.currency)}` : 'Sin nóminas todavía'}
      />
      <FichaStat label="Total pagado" value={formatCurrency(summary.totalPaid, summary.currency)} />
      <FichaStat label="Gastos pendientes" value={summary.pendingExpenses} />
    </div>
  );
}

function FichaStat({ label, value }) {
  return (
    <div>
      <p className="text-muted" style={{ fontSize: 'var(--text-xs)', marginBottom: 2 }}>
        {label}
      </p>
      <p>{value}</p>
    </div>
  );
}

function EmployeeFichaFull({ ficha, error }) {
  if (error) return <p className="alert-box alert-box-error">{error}</p>;
  if (!ficha) return <p className="text-muted">Cargando…</p>;

  return (
    <div>
      <EmployeeFichaSummary ficha={ficha} />

      <h3 className="field-label" style={{ marginTop: 20 }}>
        Nóminas
      </h3>
      {ficha.payrollItems.length === 0 && <p className="text-muted">Todavía no participó en ninguna nómina.</p>}
      {ficha.payrollItems.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Período</th>
              <th>Estado</th>
              <th className="num">Neto</th>
            </tr>
          </thead>
          <tbody>
            {ficha.payrollItems.map((item) => (
              <tr key={item.id}>
                <td>{item.payroll.label}</td>
                <td>
                  <StatusSeal status={item.payroll.status === 'PAID' ? 'paid' : 'pending'} label={item.payroll.status} />
                </td>
                <td className="num">{formatCurrency(item.netPay, item.payroll.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="field-label" style={{ marginTop: 20 }}>
        Gastos
      </h3>
      {ficha.expenses.length === 0 && <p className="text-muted">Todavía no registró ningún gasto.</p>}
      {ficha.expenses.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Descripción</th>
              <th>Estado</th>
              <th className="num">Monto</th>
            </tr>
          </thead>
          <tbody>
            {ficha.expenses.map((expense) => (
              <tr key={expense.id}>
                <td>{formatDate(new Date(expense.expenseDate))}</td>
                <td>{expense.description}</td>
                <td>
                  <StatusSeal status={expense.status === 'REIMBURSED' ? 'paid' : expense.status === 'REJECTED' ? 'rejected' : 'pending'} label={expense.status} />
                </td>
                <td className="num">{formatCurrency(expense.amount, expense.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="field-label" style={{ marginTop: 20 }}>
        Historial
      </h3>
      <DocumentTimeline steps={ficha.timelineSteps} />
    </div>
  );
}
