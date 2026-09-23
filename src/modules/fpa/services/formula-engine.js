const { Prisma } = require('@prisma/client');
const AppError = require('../../../core/utils/AppError');

const { Decimal } = Prisma;

// Interprete propio de fórmulas simples: NUNCA usa eval() ni el
// constructor Function (evita ejecutar código arbitrario que venga de
// un usuario — ver OWASP). Solo entiende números, +  -  *  /,
// paréntesis, y variables escritas entre corchetes, ej:
// "([4135] - [5310]) / [4135]" o "[4135_1] * 0.05".

function tokenize(formula) {
  const tokens = [];
  let i = 0;

  while (i < formula.length) {
    const ch = formula[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < formula.length && /[0-9.]/.test(formula[j])) j++;
      tokens.push({ type: 'NUMBER', value: formula.slice(i, j) });
      i = j;
      continue;
    }

    if (ch === '[') {
      const close = formula.indexOf(']', i);
      if (close === -1) {
        throw new AppError('Fórmula inválida: falta cerrar "]".', 400, 'INVALID_FORMULA');
      }
      const name = formula.slice(i + 1, close).trim();
      if (!name) {
        throw new AppError('Fórmula inválida: hay una variable vacía "[]".', 400, 'INVALID_FORMULA');
      }
      tokens.push({ type: 'VAR', value: name });
      i = close + 1;
      continue;
    }

    if ('+-*/()'.includes(ch)) {
      tokens.push({ type: ch, value: ch });
      i++;
      continue;
    }

    throw new AppError(`Fórmula inválida: carácter no permitido "${ch}".`, 400, 'INVALID_FORMULA');
  }

  return tokens;
}

function safeDivide(a, b) {
  if (b.isZero()) {
    throw new AppError('La fórmula intenta dividir entre cero.', 400, 'FORMULA_DIVISION_BY_ZERO');
  }
  return a.dividedBy(b);
}

// `variables` es un mapa nombre -> número (ej: { '4135': 10000 }).
function evaluateFormula(formula, variables) {
  const tokens = tokenize(formula);
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = (type) => {
    const token = tokens[pos];
    if (!token || token.type !== type) {
      throw new AppError(`Fórmula inválida cerca de "${token ? token.value : 'el final'}".`, 400, 'INVALID_FORMULA');
    }
    pos++;
    return token;
  };

  function parseFactor() {
    const token = peek();
    if (!token) {
      throw new AppError('Fórmula inválida: expresión incompleta.', 400, 'INVALID_FORMULA');
    }
    if (token.type === 'NUMBER') {
      consume('NUMBER');
      return new Decimal(token.value);
    }
    if (token.type === 'VAR') {
      consume('VAR');
      if (!(token.value in variables) || variables[token.value] === undefined || variables[token.value] === null) {
        throw new AppError(`La fórmula usa una variable desconocida: "[${token.value}]".`, 400, 'UNKNOWN_FORMULA_VARIABLE');
      }
      return new Decimal(variables[token.value]);
    }
    if (token.type === '(') {
      consume('(');
      const value = parseExpr();
      consume(')');
      return value;
    }
    if (token.type === '-') {
      consume('-');
      return parseFactor().negated();
    }
    throw new AppError(`Fórmula inválida cerca de "${token.value}".`, 400, 'INVALID_FORMULA');
  }

  function parseTerm() {
    let value = parseFactor();
    while (peek() && (peek().type === '*' || peek().type === '/')) {
      const opType = consume(peek().type).type;
      const rhs = parseFactor();
      value = opType === '*' ? value.times(rhs) : safeDivide(value, rhs);
    }
    return value;
  }

  function parseExpr() {
    let value = parseTerm();
    while (peek() && (peek().type === '+' || peek().type === '-')) {
      const opType = consume(peek().type).type;
      const rhs = parseTerm();
      value = opType === '+' ? value.plus(rhs) : value.minus(rhs);
    }
    return value;
  }

  const result = parseExpr();
  if (pos !== tokens.length) {
    throw new AppError('Fórmula inválida: sobran caracteres al final.', 400, 'INVALID_FORMULA');
  }
  return result;
}

// Valida solo la sintaxis de una fórmula (paréntesis balanceados,
// operadores bien puestos, variables entre corchetes bien formadas),
// sin necesitar los valores reales todavía — para poder avisar al
// usuario apenas escribe la fórmula, no hasta que alguien intente
// calcular un reporte con ella. Cualquier variable "existe" con un
// valor de prueba (1) durante esta validación.
function assertValidFormulaSyntax(formula) {
  const anyVariable = new Proxy({}, { has: () => true, get: () => 1 });
  evaluateFormula(formula, anyVariable);
}

module.exports = { evaluateFormula, assertValidFormulaSyntax };
