import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { personalDashboardApi, personalAlertsApi } from '../../api/personal';
import { ApiError } from '../../api/client';
import { formatCurrency } from '../../utils/format';
import { useCurrency } from '../../context/CurrencyContext';
import StatCard from '../../components/StatCard';
import MetricTrendChart from '../../components/MetricTrendChart';

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
  const [trend, setTrend] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [scanError, setScanError] = useState('');

  async function handleScan() {
    setIsScanning(true);
    setScanMessage('');
    setScanError('');
    try {
      const result = await personalAlertsApi.scan();
      setScanMessage(
        result.createdCount > 0
          ? `Se generaron ${result.createdCount} alerta(s) nuevas — revísalas en la campana de notificaciones.`
          : 'No hay nómina ni gastos de personal con una acción nueva pendiente de avisar.'
      );
    } catch (err) {
      setScanError(err instanceof ApiError ? err.message : 'No se pudo escanear las acciones pendientes.');
    } finally {
      setIsScanning(false);
    }
  }

  useEffect(() => {
    personalDashboardApi
      .get()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'No se pudo cargar el resumen de Personal.'))
      .finally(() => setIsLoading(false));
    personalDashboardApi
      .getTrend(6)
      .then(setTrend)
      .catch(() => setTrend(null));
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
          {/* Alertas (sección 6 del pedido de integración): mismo
              patrón ya usado en Clientes de Cuentas por Cobrar
              ("Escanear cobranza atrasada") — dispara a mano el mismo
              escaneo que ya corre solo todos los días a las 7:20am. */}
          <button type="button" className="btn btn-small" onClick={handleScan} disabled={isScanning}>
            {isScanning ? 'Escaneando…' : 'Escanear pendientes'}
          </button>
        </div>
      </div>

      {error && <p className="alert-box alert-box-error">{error}</p>}
      {scanMessage && <p className="alert-box alert-box-success">{scanMessage}</p>}
      {scanError && <p className="alert-box alert-box-error">{scanError}</p>}

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

      {/* Analítica (sección 4 del pedido de integración): evolución del
          costo de personal de los últimos 6 meses — mismo componente
          genérico ya usado por Métricas del Negocio, sin construir un
          módulo BI nuevo. Costo real (nómina pagada + gastos
          reembolsados), nunca lo aprobado-sin-ejecutar. */}
      {trend && trend.some((entry) => Number(entry.value) > 0) && (
        <div style={{ marginTop: 24 }}>
          <h3 className="field-label">Evolución del costo de personal</h3>
          <MetricTrendChart entries={trend} />
        </div>
      )}
    </div>
  );
}
