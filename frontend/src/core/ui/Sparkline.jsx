import './Sparkline.css';

// Línea de tendencia diminuta, SVG plano (mismo criterio que los
// gráficos del Panel principal — sin librería nueva). `values` es una
// lista de números en orden cronológico; con menos de 2 puntos no hay
// tendencia que mostrar.
export default function Sparkline({ values, width = 90, height = 26, tone = 'neutral' }) {
  if (!values || values.length < 2) return null;

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const pad = 2;
  const points = values
    .map((v, i) => `${(i * stepX).toFixed(1)},${(height - pad - ((v - min) / range) * (height - pad * 2)).toFixed(1)}`)
    .join(' ');

  const colorVar =
    tone === 'positive' ? 'var(--color-positive)' : tone === 'negative' ? 'var(--color-negative)' : 'var(--color-silver-strong)';

  return (
    <svg className="ui-sparkline" viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-hidden="true">
      <polyline points={points} fill="none" stroke={colorVar} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
