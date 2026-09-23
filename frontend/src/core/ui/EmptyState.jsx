import Button from './Button';
import './EmptyState.css';

export default function EmptyState({ icon = '◇', message, actionLabel, onAction }) {
  return (
    <div className="ui-empty-state">
      <div className="ui-empty-state-icon" aria-hidden="true">
        {icon}
      </div>
      <p className="ui-empty-state-message">{message}</p>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
