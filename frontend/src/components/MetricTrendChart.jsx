import { formatCurrency, formatDate } from '../utils/format';
import './MetricTrendChart.css';

const HEIGHT = 160;
const WIDTH_PER_POINT = 70;
const PADDING_X = 24;

export default function MetricTrendChart({ entries, unit }) {
  if (entries.length === 0) return null;

  const values = entries.map((e) => Number(e.value));
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const range = max - min || 1;
  const width = Math.max(entries.length * WIDTH_PER_POINT, 200);

  const points = entries.map((entry, i) => {
    const x = entries.length === 1 ? width / 2 : PADDING_X + (i / (entries.length - 1)) * (width - PADDING_X * 2);
    const y = HEIGHT - ((Number(entry.value) - min) / range) * HEIGHT;
    return { x, y, entry };
  });

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  return (
    <div className="metric-trend-chart">
      <svg viewBox={`0 0 ${width} ${HEIGHT + 30}`} width="100%" height={HEIGHT + 30} role="img" aria-label="Evolución de la métrica">
        <path d={path} fill="none" stroke="var(--color-brand-strong)" strokeWidth="2" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill="var(--color-brand-strong)">
              <title>{`${formatDate(new Date(p.entry.date))}: ${unit ? `${p.entry.value} ${unit}` : formatCurrency(p.entry.value)}`}</title>
            </circle>
            <text x={p.x} y={HEIGHT + 20} textAnchor="middle" className="metric-trend-chart-label">
              {formatDate(new Date(p.entry.date))}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
