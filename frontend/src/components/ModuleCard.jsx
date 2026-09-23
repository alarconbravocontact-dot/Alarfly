import { Link } from 'react-router-dom';
import './ModuleCard.css';

export default function ModuleCard({ to, icon, title, description }) {
  return (
    <Link to={to} className="module-card">
      <span className="module-card-icon" aria-hidden="true">
        {icon}
      </span>
      <div>
        <p className="module-card-title">{title}</p>
        <p className="module-card-description">{description}</p>
      </div>
      <span className="module-card-arrow" aria-hidden="true">
        →
      </span>
    </Link>
  );
}
