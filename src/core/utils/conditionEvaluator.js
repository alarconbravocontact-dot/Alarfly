const AppError = require('./AppError');

// Evaluador seguro de condiciones: NUNCA usa eval() ni el constructor
// Function (evita ejecutar código arbitrario que venga de un usuario —
// ver OWASP). La condición se guarda como un árbol JSON, no como texto,
// así que ni siquiera hace falta un parser: solo se recorre el árbol.
//
// Forma de una condición:
//   { "all": [condición, condición, ...] }   -- todas deben cumplirse (Y)
//   { "any": [condición, condición, ...] }   -- alguna debe cumplirse (O)
//   { "field": "taxBase", "op": "gt", "value": 500 }  -- comparación simple
//
// Movido a core porque ahora 2 módulos lo necesitan (Fiscal, punto 2, y
// Análisis Avanzados, para las condiciones de alerta sobre un resultado)
// — regla 1 de la arquitectura maestra.

const OPERATORS = {
  eq: (a, b) => a === b,
  neq: (a, b) => a !== b,
  gt: (a, b) => Number(a) > Number(b),
  gte: (a, b) => Number(a) >= Number(b),
  lt: (a, b) => Number(a) < Number(b),
  lte: (a, b) => Number(a) <= Number(b),
  exists: (a) => a !== undefined && a !== null && a !== '',
  not_exists: (a) => a === undefined || a === null || a === '',
};

function evaluateCondition(condition, context) {
  if (!condition || typeof condition !== 'object') {
    throw new AppError('La condición no es válida.', 400, 'INVALID_CONDITION');
  }

  if (Array.isArray(condition.all)) {
    return condition.all.every((child) => evaluateCondition(child, context));
  }
  if (Array.isArray(condition.any)) {
    return condition.any.some((child) => evaluateCondition(child, context));
  }

  const { field, op, value } = condition;
  const operatorFn = OPERATORS[op];
  if (!field || !operatorFn) {
    throw new AppError(`Condición inválida: operador "${op}" no soportado.`, 400, 'INVALID_CONDITION');
  }
  return operatorFn(context[field], value);
}

module.exports = { evaluateCondition };
