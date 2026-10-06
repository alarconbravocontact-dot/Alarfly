import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { personalDashboardApi } from '../../api/personal';
import { ApiError } from '../../api/client';
import { formatCurrency } from '../../utils/format';
import { useCurrency } from '../../context/CurrencyContext';
import StatCard from '../../components/StatCard';

// Sección 17 del prompt del módulo: solo los 6 números pedidos, sin
// gráficos — y los 3 accesos rápidos pedidos explícitamente.
// Límite honesto (documentado en PERSONAL_MODULE_FINAL.md): los
// totales suman nóminas/gastos sin convertir moneda — correcto
// mientras todos se registren en la moneda base de la empresa, que es
// el caso de uso principal de este módulo.
export default function PersonalSummaryPage() {
  const navigate = useNavigate();
  const { baseCurrency } = useCurrency();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    personalDashboardApi
      .get()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el resumen de Personal.'))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="field-label">Resumen del mes</h2>
        <div className="btn-row">
          <button type="button" className="btn btn-primary btn-small" onClick={() => navigate('/personal/empleados', { state: { autoOpenCreate: true } })}>
            + Nuevo empleado
          </button>
          <button type="button" className="btn btn-small" onClick={() => navigate('/personal/nomina', { state: { autoOpenCreate: true } })}>
            + Nueva nómina
          </button>
          <button type="button" className="btn btn-small" onClick={() => navigate('/personal/gastos', { state: { autoOpenCreate: true } })}>
            + Registrar gasto
          </button>
        </div>
      </div>

      {error && <p className="alert-box alert-box-error">{error}</p>}

      <section className="form-grid">
        <StatCard label="Empleados activos" value={isLoading ? '—' : data.activeEmployeeCount} isLoading={isLoading} />
        <StatCard
          label="Nómina del período"
          value={isLoading ? '—' : formatCurrency(data.payrollThisPeriod, baseCurrency)}
          hint="Nóminas cuyo período de pago cae este mes."
          isLoading={isLoading}
        />
        <StatCard
          label="Nómina pendiente"
          value={isLoading ? '—' : formatCurrency(data.pendingPayroll, baseCurrency)}
          tone={!isLoading && Number(data.pendingPayroll) > 0 ? 'warning' : 'positive'}
          hint="Nóminas aprobadas, todavía sin pagar."
          isLoading={isLoading}
        />
        <StatCard
          label="Gastos pendientes"
          value={isLoading ? '—' : formatCurrency(data.pendingExpenses, baseCurrency)}
          tone={!isLoading && Number(data.pendingExpenses) > 0 ? 'warning' : 'positive'}
          hint="Gastos de personal esperando aprobación."
          isLoading={isLoading}
        />
        <StatCard
          label="Gastos del período"
          value={isLoading ? '—' : formatCurrency(data.expensesThisPeriod, baseCurrency)}
          hint="Todos los gastos registrados este mes, sin importar su estado."
          isLoading={isLoading}
        />
        <StatCard
          label="Costo total de personal"
          value={isLoading ? '—' : formatCurrency(data.totalPersonnelCost, baseCurrency)}
          hint="Nómina pagada + gastos reembolsados este mes."
          isLoading={isLoading}
        />
      </section>
    </div>
  );
}
