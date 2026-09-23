import './Button.css';

export default function Button({
  as: As = 'button',
  variant = 'secondary',
  size = 'md',
  children,
  className = '',
  ...rest
}) {
  const classes = ['ui-btn', `ui-btn-${variant}`, size === 'sm' ? 'ui-btn-sm' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <As className={classes} {...rest}>
      {children}
    </As>
  );
}
