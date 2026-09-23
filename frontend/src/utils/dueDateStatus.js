// Mismo cálculo que ya usa el backend (core/alerts/alerts.rules.js
// daysUntil) para "cuántos días faltan para vencer" — se porta acá
// porque el frontend es un proyecto aparte, pero la fórmula es
// idéntica a propósito, para que un documento nunca se vea "al día"
// en una pantalla y "vencido" en otra.
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function daysUntil(dueDate, referenceDate = new Date()) {
  return Math.round((new Date(dueDate).getTime() - new Date(referenceDate).getTime()) / MS_PER_DAY);
}

// Los 3 niveles semafóricos: CRITICAL (rojo, ya venció — límite
// objetivo, no depende de ninguna configuración), WARNING (amarillo,
// dentro del umbral configurable por el Administrador), OK (verde).
export function computeDueDateStatus(dueDate, thresholdDays, referenceDate = new Date()) {
  const days = daysUntil(dueDate, referenceDate);
  if (days < 0) return 'CRITICAL';
  if (days <= thresholdDays) return 'WARNING';
  return 'OK';
}

export function formatDueDateLabel(dueDate, referenceDate = new Date()) {
  const days = daysUntil(dueDate, referenceDate);
  if (days < 0) return `Vencida hace ${Math.abs(days)} día${Math.abs(days) === 1 ? '' : 's'}`;
  if (days === 0) return 'Vence hoy';
  return `Vence en ${days} día${days === 1 ? '' : 's'}`;
}
