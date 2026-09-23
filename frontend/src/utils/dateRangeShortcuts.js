import { toIsoDate } from './format';

function utcDate(year, month, day) {
  return new Date(Date.UTC(year, month, day));
}

function startOfWeekMonday(date) {
  const day = date.getUTCDay(); // 0=domingo..6=sábado
  const diff = day === 0 ? 6 : day - 1; // días desde el lunes
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - diff);
  return monday;
}

// El año fiscal que contiene `date`, dado el mes en que arranca
// (1=enero, hasta 12) — nunca asume que siempre empieza en enero.
// `offsetYears` negativo retrocede N años fiscales completos (ej. -1
// para el año fiscal anterior al actual).
export function getFiscalYearRange(date, fiscalYearStartMonth = 1, offsetYears = 0) {
  const startMonthIndex = (fiscalYearStartMonth || 1) - 1; // 0-based
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  // Si el mes actual ya alcanzó el mes de arranque, el año fiscal
  // "actual" empezó este año calendario; si no, empezó el anterior.
  let fiscalStartYear = month >= startMonthIndex ? year : year - 1;
  fiscalStartYear += offsetYears;
  const from = utcDate(fiscalStartYear, startMonthIndex, 1);
  const to = new Date(utcDate(fiscalStartYear + 1, startMonthIndex, 1).getTime() - 86400000);
  return { from, to };
}

// Los 6 atajos pedidos, más "Personalizado" (que decide la pantalla
// que usa este helper, no se calcula acá). "Año pasado" respeta el
// mismo cierre fiscal configurado que "Año fiscal actual" — es el año
// fiscal inmediatamente anterior, no necesariamente enero-diciembre.
export function getShortcutRanges(referenceDate = new Date(), fiscalYearStartMonth = 1) {
  const now = utcDate(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate());

  const monday = startOfWeekMonday(now);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const monthFrom = utcDate(now.getUTCFullYear(), now.getUTCMonth(), 1);
  const monthTo = new Date(utcDate(now.getUTCFullYear(), now.getUTCMonth() + 1, 1).getTime() - 86400000);

  const quarterIndex = Math.floor(now.getUTCMonth() / 3);
  const quarterFrom = utcDate(now.getUTCFullYear(), quarterIndex * 3, 1);
  const quarterTo = new Date(utcDate(now.getUTCFullYear(), quarterIndex * 3 + 3, 1).getTime() - 86400000);

  const fiscalYear = getFiscalYearRange(now, fiscalYearStartMonth, 0);
  const lastFiscalYear = getFiscalYearRange(now, fiscalYearStartMonth, -1);

  const iso = (range) => ({ from: toIsoDate(range.from), to: toIsoDate(range.to) });

  return [
    { key: 'today', label: 'Hoy', ...iso({ from: now, to: now }) },
    { key: 'this-week', label: 'Esta semana', ...iso({ from: monday, to: sunday }) },
    { key: 'this-month', label: 'Este mes', ...iso({ from: monthFrom, to: monthTo }) },
    { key: 'this-quarter', label: 'Trimestre actual', ...iso({ from: quarterFrom, to: quarterTo }) },
    { key: 'fiscal-year', label: 'Año fiscal actual', ...iso(fiscalYear) },
    { key: 'last-year', label: 'Año pasado', ...iso(lastFiscalYear) },
  ];
}

// Innovación pedida explícitamente: variación % entre dos períodos que
// se comparan, calculada una sola vez acá — mismo criterio que
// `buildVariance` del backend (Contabilidad, reports.service.js):
// nunca divide entre cero, null si no hay una base real de comparación.
export function calculateVariancePercentage(current, previous) {
  const curr = Number(current);
  const prev = Number(previous);
  if (Number.isNaN(curr) || Number.isNaN(prev)) return null;
  if (prev === 0) return curr === 0 ? 0 : null;
  return Number((((curr - prev) / Math.abs(prev)) * 100).toFixed(2));
}
