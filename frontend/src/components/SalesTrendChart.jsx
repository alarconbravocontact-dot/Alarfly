import { formatCurrency } from '../utils/format';
import './SalesTrendChart.css';

const HEIGHT = 160;
const WIDTH_PER_POINT = 70;
const PADDING_X = 24;

function monthLabel(monthKey) {
  const [year, month] = monthKey.split('-');
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return date.toLocaleDateString('es', { month: 'short', year: '2-digit', timeZone: 'UTC' });
}

export default function SalesTrendChart({ data, currency = 'USD', onPointClick }) {
  if (!data || data.length === 0) return null;
  const clickable = typeof onPointClick === 'function';

  const values = data.map((d) => Number(d.totalSales));
  const max = Math.max(...values, 1);
  const width = Math.max(data.length * WIDTH_PER_POINT, 200);

  const points = data.map((d, i) => {
    const x = data.length === 1 ? width / 2 : PADDING_X + (i / (data.length - 1)) * (width - PADDING_X * 2);
    const y = HEIGHT - (Number(d.totalSales) / max) * HEIGHT;
    return { x, y, point: d };
  });

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${path} L ${points[points.length - 1].x} ${HEIGHT} L ${points[0].x} ${HEIGHT} Z`;

  return (
    <div className="sales-trend-chart">
      <svg
        viewBox={`0 0 ${width} ${HEIGHT + 34}`}
        width="100%"
        height={HEIGHT + 34}
        role="img"
        aria-label="Comportamiento de ventas de los últimos meses"
        preserveAspectRatio="xMidYMid meet"
      >
        <path d={areaPath} fill="var(--color-silver-strong)" opacity="0.12" stroke="none" />
        <path d={path} fill="none" stroke="var(--color-silver-strong)" strokeWidth="2" />
        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={clickable ? 8 : 4}
              fill={clickable ? 'transparent' : 'var(--color-silver-strong)'}
              className={clickable ? 'sales-trend-chart-hit' : undefined}
              onClick={clickable ? () => onPointClick(p.point) : undefined}
            >
              <title>{`${monthLabel(p.point.month)}: ${formatCurrency(p.point.totalSales, currency)} en ${p.point.invoiceCount} factura(s)${clickable ? ' — clic para ver las facturas' : ''}`}</title>
            </circle>
            {clickable && <circle cx={p.x} cy={p.y} r="4" fill="var(--color-silver-strong)" style={{ pointerEvents: 'none' }} />}
            <text x={p.x} y={HEIGHT + 20} textAnchor="middle" className="sales-trend-chart-label">
              {monthLabel(p.point.month)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
