// Evaluador seguro de expresiones aritméticas simples para campos de
// monto (ej. "150+30-5"): nunca usa eval() ni new Function() — mismo
// criterio de seguridad que el motor de fórmulas de FP&A (backend),
// reescrito acá porque necesita resolverse mientras el usuario todavía
// está escribiendo, sin ida y vuelta al servidor.
function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const start = i;
      while (i < input.length && /[0-9.]/.test(input[i])) i++;
      tokens.push({ type: 'number', value: parseFloat(input.slice(start, i)) });
      continue;
    }
    if ('+-*/()'.includes(c)) {
      tokens.push({ type: c });
      i++;
      continue;
    }
    throw new Error(`Carácter no permitido: "${c}"`);
  }
  return tokens;
}

function parseTokens(tokens) {
  let pos = 0;
  const peek = () => tokens[pos];
  const consume = (type) => {
    const t = tokens[pos];
    if (!t || (type && t.type !== type)) throw new Error('Expresión inválida.');
    pos++;
    return t;
  };

  function parseFactor() {
    const t = peek();
    if (!t) throw new Error('Expresión inválida.');
    if (t.type === 'number') {
      consume();
      return t.value;
    }
    if (t.type === '(') {
      consume('(');
      const v = parseAddSub();
      consume(')');
      return v;
    }
    if (t.type === '-') {
      consume('-');
      return -parseFactor();
    }
    if (t.type === '+') {
      consume('+');
      return parseFactor();
    }
    throw new Error('Expresión inválida.');
  }

  function parseMulDiv() {
    let v = parseFactor();
    while (peek() && (peek().type === '*' || peek().type === '/')) {
      const op = consume().type;
      const rhs = parseFactor();
      v = op === '*' ? v * rhs : v / rhs;
    }
    return v;
  }

  function parseAddSub() {
    let v = parseMulDiv();
    while (peek() && (peek().type === '+' || peek().type === '-')) {
      const op = consume().type;
      const rhs = parseMulDiv();
      v = op === '+' ? v + rhs : v - rhs;
    }
    return v;
  }

  const result = parseAddSub();
  if (pos !== tokens.length) throw new Error('Expresión inválida.');
  return result;
}

// Devuelve el número resuelto, o null si el texto no es una expresión
// válida (ej. está vacío, tiene letras, o quedó a medio escribir como
// "150+"). Nunca lanza — pensado para llamarse en cada cambio de texto
// sin tener que envolverlo en try/catch en cada pantalla.
export function evaluateMathExpression(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;
  if (!/^[0-9+\-*/().\s]+$/.test(trimmed)) return null;
  try {
    const tokens = tokenize(trimmed);
    if (tokens.length === 0) return null;
    const result = parseTokens(tokens);
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

// True si el texto tiene al menos un operador real (no solo un signo
// negativo inicial de un número simple) — para decidir si vale la pena
// mostrar "= resultado" en vez de tratarlo como un número ya escrito
// directo.
export function isExpression(text) {
  const trimmed = String(text ?? '').trim();
  return /[+*/]/.test(trimmed) || /.-/.test(trimmed);
}

// Divisor de gastos (la innovación pedida explícitamente): detecta
// específicamente "monto/partes" (ej. "300/3") — un caso particular de
// división simple, no cualquier expresión que contenga "/".
export function detectSplitExpression(text) {
  const match = String(text ?? '')
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+)$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const parts = Number(match[2]);
  if (!Number.isFinite(amount) || !Number.isInteger(parts) || parts < 2) return null;
  const perPart = Math.round((amount / parts) * 100) / 100;
  return { amount, parts, perPart };
}
