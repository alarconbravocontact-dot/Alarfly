// Búsqueda difusa liviana (sin librería nueva, mismo criterio que el
// resto del proyecto): compara la búsqueda contra el texto de cada
// candidato exigiendo que sus caracteres aparezcan EN ORDEN dentro del
// texto (no necesariamente seguidos) — es el mismo principio que usan
// los buscadores rápidos tipo "Ir a archivo" de los editores de código,
// así que "bnc" encuentra "Banco" y "cli atrsd" encuentra
// "Cliente Atrasado Demo".
//
// Devuelve un puntaje más alto para: coincidencia exacta, coincidencia
// al inicio del texto, caracteres consecutivos, y coincidencias justo
// después de un separador de palabra (espacio, guion, punto). Devuelve
// `null` si la búsqueda no es ni siquiera una subsecuencia del texto.
export function fuzzyScore(query, target) {
  if (!query) return 0;
  if (!target) return null;

  const q = query.trim().toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 0;

  if (t === q) return 1000;
  if (t.startsWith(q)) return 500 - Math.min(target.length, 100);
  if (t.includes(q)) return 300 - Math.min(target.length, 100);

  let score = 0;
  let searchFrom = 0;
  let consecutive = 0;

  for (let i = 0; i < q.length; i += 1) {
    const ch = q[i];
    const foundAt = t.indexOf(ch, searchFrom);
    if (foundAt === -1) return null;

    if (foundAt === searchFrom) {
      consecutive += 1;
      score += 10 + consecutive * 2;
    } else {
      consecutive = 0;
      score += 1;
    }
    if (foundAt > 0 && /[\s\-_./]/.test(t[foundAt - 1])) {
      score += 5;
    }
    searchFrom = foundAt + 1;
  }

  score -= (t.length - q.length) * 0.05;
  return score;
}

// `getText(item)` devuelve el texto contra el que se compara la
// búsqueda; `getBoost(item)` es opcional (ej. un puntaje de "usado
// recientemente") y se suma al puntaje de coincidencia, para que lo más
// reciente gane empates o incluso adelante a una coincidencia más débil.
export function fuzzySearch(query, items, getText, getBoost) {
  const trimmed = (query || '').trim();
  if (!trimmed) {
    const boosted = items.map((item) => ({ item, score: getBoost ? getBoost(item) : 0 }));
    boosted.sort((a, b) => b.score - a.score);
    return boosted;
  }

  const scored = [];
  for (const item of items) {
    const base = fuzzyScore(trimmed, getText(item));
    if (base === null) continue;
    scored.push({ item, score: base + (getBoost ? getBoost(item) : 0) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored;
}
