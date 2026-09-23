import './StatCard.css';

export default function StatCard({ label, value, hint, tone = 'neutral', isLoading, error }) {
  return (
    <div className="stat-card">
      <p className="stat-card-label">{label}</p>

      {isLoading && <div className="stat-card-skeleton" />}

      {!isLoading && error && <p className="stat-card-error">No se pudo calcular.</p>}

      {!isLoading && !error && (
        <>
          <p className={`stat-card-value stat-card-value--${tone}`}>{value}</p>
          {hint && <p className="stat-card-hint">{hint}</p>}
        </>
      )}
    </div>
  );
}
