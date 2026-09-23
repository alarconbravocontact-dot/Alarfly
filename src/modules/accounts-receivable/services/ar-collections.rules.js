// Función pura: dado cuántos días lleva vencida una factura y la lista
// de niveles configurados (cada uno con un umbral de días y una
// acción), devuelve el nivel más severo cuyo umbral ya se cruzó — o
// `null` si todavía no llega al primer nivel.
function resolveEscalationLevel(daysOverdue, levels) {
  if (!Array.isArray(levels) || levels.length === 0) return null;

  const sorted = [...levels].sort((a, b) => a.daysOverdue - b.daysOverdue);
  let matched = null;
  for (const level of sorted) {
    if (daysOverdue >= level.daysOverdue) {
      matched = level;
    }
  }
  return matched;
}

module.exports = { resolveEscalationLevel };
