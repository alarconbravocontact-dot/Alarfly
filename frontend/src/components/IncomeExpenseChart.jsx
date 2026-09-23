import { formatCurrency } from '../utils/format';
import './IncomeExpenseChart.css';

const CHART_HEIGHT = 160;
const GROUP_WIDTH = 64;
const BAR_WIDTH = 20;

export default function IncomeExpenseChart({ data, currency = 'USD', onSegmentClick }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const width = data.length * GROUP_WIDTH;
  const clickable = typeof onSegmentClick === 'function';

  return (
    <div className="income-expense-chart">
      <svg
        viewBox={`0 0 ${width} ${CHART_HEIGHT + 34}`}
        width="100%"
        height={CHART_HEIGHT + 34}
        role="img"
        aria-label="Ingresos y egresos de los últimos meses"
        preserveAspectRatio="xMidYMid meet"
      >
        {data.map((d, i) => {
          const x = i * GROUP_WIDTH;
          const incomeHeight = (d.income / max) * CHART_HEIGHT;
          const expenseHeight = (d.expense / max) * CHART_HEIGHT;
          return (
            <g key={d.label}>
              <rect
                x={x + 8}
                y={CHART_HEIGHT - incomeHeight}
                width={BAR_WIDTH}
                height={Math.max(incomeHeight, 1)}
                fill="var(--color-positive)"
                rx="2"
                className={clickable ? 'income-expense-chart-bar' : undefined}
                onClick={clickable ? () => onSegmentClick('INCOME', d) : undefined}
              >
                <title>{`Ingresos ${d.label}: ${formatCurrency(d.income, currency)}${clickable ? ' — clic para ver las transacciones' : ''}`}</title>
              </rect>
              <rect
                x={x + 8 + BAR_WIDTH + 4}
                y={CHART_HEIGHT - expenseHeight}
                width={BAR_WIDTH}
                height={Math.max(expenseHeight, 1)}
                fill="var(--color-negative)"
                rx="2"
                className={clickable ? 'income-expense-chart-bar' : undefined}
                onClick={clickable ? () => onSegmentClick('EXPENSE', d) : undefined}
              >
                <title>{`Egresos ${d.label}: ${formatCurrency(d.expense, currency)}${clickable ? ' — clic para ver las transacciones' : ''}`}</title>
              </rect>
              <text x={x + GROUP_WIDTH / 2} y={CHART_HEIGHT + 20} textAnchor="middle" className="income-expense-chart-label">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="income-expense-legend">
        <span>
          <i className="income-expense-legend-dot income-expense-legend-dot-positive" /> Ingresos
        </span>
        <span>
          <i className="income-expense-legend-dot income-expense-legend-dot-negative" /> Egresos
        </span>
      </div>
    </div>
  );
}
