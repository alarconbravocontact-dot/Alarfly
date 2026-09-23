export function formatCurrency(value, currency = 'USD') {
  const number = Number(value);
  if (Number.isNaN(number)) return '—';
  return new Intl.NumberFormat('es', { style: 'currency', currency, maximumFractionDigits: 2 }).format(number);
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('es', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

export function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

export function currentMonthRange() {
  const now = new Date();
  const from = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const to = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0));
  return { from: toIsoDate(from), to: toIsoDate(to) };
}
