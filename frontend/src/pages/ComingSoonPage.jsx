import './ComingSoonPage.css';

export default function ComingSoonPage({ title, description }) {
  return (
    <div className="coming-soon">
      <div className="coming-soon-card">
        <span className="coming-soon-tag">Próximamente</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}
