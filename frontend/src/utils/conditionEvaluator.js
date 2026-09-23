// Versión para el navegador del evaluador seguro de condiciones que ya
// usa el backend (core/utils/conditionEvaluator.js): mismo formato de
// árbol JSON ({all/any: [...]}, {field, op, value}), nunca eval() ni
// new Function(). Se agregan dos cosas que el backend no necesita: el
// operador "contains" (para filtros de texto tipo "Cliente contiene…")
// y comparación consciente de fechas (para que "gte"/"lte" funcionen
// bien contra un campo de fecha, no solo contra números).
function toComparable(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }
  return Number(value);
}

const OPERATORS = {
  eq: (a, b) => String(a ?? '') === String(b ?? ''),
  neq: (a, b) => String(a ?? '') !== String(b ?? ''),
  gt: (a, b) => toComparable(a) > toComparable(b),
  gte: (a, b) => toComparable(a) >= toComparable(b),
  lt: (a, b) => toComparable(a) < toComparable(b),
  lte: (a, b) => toComparable(a) <= toComparable(b),
  contains: (a, b) => String(a ?? '').toLowerCase().includes(String(b ?? '').toLowerCase()),
  exists: (a) => a !== undefined && a !== null && a !== '',
  not_exists: (a) => a === undefined || a === null || a === '',
};

function getByPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

export function evaluateCondition(condition, context) {
  if (!condition || typeof condition !== 'object') return true;
  if (Array.isArray(condition.all)) return condition.all.every((child) => evaluateCondition(child, context));
  if (Array.isArray(condition.any)) return condition.any.some((child) => evaluateCondition(child, context));

  const { field, op, value } = condition;
  const operatorFn = OPERATORS[op];
  if (!field || !operatorFn) return true;
  if (value === undefined || value === '') return true;
  return operatorFn(getByPath(context, field), value);
}
