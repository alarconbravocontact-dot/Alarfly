import { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import HelpTooltip from '../../components/HelpTooltip';
import { formatDate } from '../../utils/format';

const SERIES_COLORS = ['var(--color-positive)', 'var(--color-warning)', 'var(--color-negative)', 'var(--color-brand-dim)'];
const LABEL_KEYS = ['name', 'period', 'month', 'semana', 'volume', 'periodo'];

function inferChartFields(rows) {
  if (!rows || rows.length === 0) return { labelKey: null, valueKeys: [] };
  const keys = Object.keys(rows[0]);
  const labelKey = keys.find((k) => LABEL_KEYS.includes(k)) || keys[0];
  const valueKeys = keys.filter((k) => k !== labelKey && typeof rows[0][k] === 'number');
  return { labelKey, valueKeys };
}

function AnalysisChart({ chartType, chartData }) {
  const { labelKey, valueKeys } = inferChartFields(chartData);
  if (!labelKey || valueKeys.length === 0) return null;

  if (chartType === 'COMPOSITION' && valueKeys.length === 1) {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={chartData} dataKey={valueKeys[0]} nameKey={labelKey} outerRadius={100} label>
            {chartData.map((_, index) => (
              <Cell key={index} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'TREND_LINE') {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey={labelKey} stroke="var(--color-text-secondary)" />
          <YAxis stroke="var(--color-text-secondary)" />
          <Tooltip />
          <Legend />
          {valueKeys.map((key, index) => (
            <Line key={key} type="monotone" dataKey={key} stroke={SERIES_COLORS[index % SERIES_COLORS.length]} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // COMPOSITION con varias series, o COMPARISON: barras.
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey={labelKey} stroke="var(--color-text-secondary)" />
        <YAxis stroke="var(--color-text-secondary)" />
        <Tooltip />
        <Legend />
        {valueKeys.map((key, index) => (
          <Bar key={key} dataKey={key} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function formatPrimitive(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return value.toLocaleString('es');
  return String(value);
}

// El resultado numérico varía de forma por tipo de análisis (a veces
// es plano, a veces trae grupos, a veces una lista de filas) — se
// renderiza de forma genérica en vez de necesitar una vista distinta
// por cada uno de los 16 tipos.
function NumericResultView({ value, depth = 0 }) {
  if (Array.isArray(value)) {
    if (value.length === 0) return <p className="text-muted">Sin datos.</p>;
    if (typeof value[0] === 'object' && value[0] !== null) {
      const columns = Object.keys(value[0]);
      return (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {value.map((row, index) => (
                <tr key={index}>
                  {columns.map((col) => (
                    <td key={col}>{typeof row[col] === 'object' ? JSON.stringify(row[col]) : formatPrimitive(row[col])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return <p>{value.map(formatPrimitive).join(', ')}</p>;
  }

  if (value !== null && typeof value === 'object') {
    return (
      <div className="form-grid" style={{ marginLeft: depth * 12 }}>
        {Object.entries(value).map(([key, val]) => (
          <div key={key} className="field">
            <span>{key}</span>
            {val !== null && typeof val === 'object' ? <NumericResultView value={val} depth={depth + 1} /> : <strong>{formatPrimitive(val)}</strong>}
          </div>
        ))}
      </div>
    );
  }

  return <p style={{ fontSize: 'var(--text-xl, 1.5rem)', fontWeight: 600 }}>{formatPrimitive(value)}</p>;
}

function RecommendationRow({ recommendation }) {
  const quantified =
    recommendation.quantifiedType === 'PERCENTAGE'
      ? `${Number(recommendation.quantifiedValue).toFixed(1)}%`
      : recommendation.quantifiedType === 'AMOUNT'
        ? Number(recommendation.quantifiedValue).toLocaleString('es', { style: 'currency', currency: 'USD' })
        : null;

  return (
    <li style={{ fontWeight: recommendation.isPrimary ? 600 : 400 }}>
      {recommendation.text}
      {quantified && (
        <span className="badge badge-positive" style={{ marginLeft: 8 }}>
          {quantified}
        </span>
      )}
    </li>
  );
}

// Las 6 partes obligatorias, en el orden pedido: gráfico, resultado
// numérico, causa, interpretación simple, metodología (colapsable) y
// sugerencias.
export default function AnalysisResultView({ report }) {
  const [showMethodology, setShowMethodology] = useState(false);

  if (!report) return null;

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="field-label">
          Resultado del análisis
          <HelpTooltip text="Este resultado quedó archivado automáticamente — puedes volver a verlo cuando quieras desde el Repositorio de Reportes." />
        </h2>
        <span className="text-muted">
          {formatDate(new Date(report.createdAt))} · {report.triggerSource === 'AUTOMATIC' ? 'Automático' : 'Manual'}
          {report.triggeredByUser ? ` · ${report.triggeredByUser.name}` : ''}
        </span>
      </div>

      <AnalysisChart chartType={report.chartType} chartData={report.chartData} />

      <section className="section-title">Resultado numérico</section>
      <NumericResultView value={report.numericResult} />

      <section className="section-title">¿Por qué dio este resultado?</section>
      <p>{report.causeExplanation}</p>

      <section className="section-title">Qué significa esto para tu negocio</section>
      <p>{report.simpleInterpretation}</p>

      <section className="section-title">
        <button type="button" className="btn btn-small" onClick={() => setShowMethodology((v) => !v)}>
          {showMethodology ? 'Ocultar cómo se calculó' : 'Ver cómo se calculó'}
        </button>
      </section>
      {showMethodology && <p className="text-muted">{report.methodology}</p>}

      <section className="section-title">Sugerencias</section>
      <ul>
        {report.recommendations.map((recommendation, index) => (
          <RecommendationRow key={index} recommendation={recommendation} />
        ))}
      </ul>
    </div>
  );
}
