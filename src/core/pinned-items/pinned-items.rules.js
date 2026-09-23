const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_STALE_DAYS = 21;

function daysSince(date, now) {
  return (now.getTime() - new Date(date).getTime()) / MS_PER_DAY;
}

// Función pura: puntaje de frecuencia real reciente de un ítem
// anclado — más visitas y más recientes puntúan más alto; un ítem
// nunca visitado puntúa 0 (queda al final, antes de decidir por
// antigüedad de anclado). No es solo "contar visitas": una visita de
// hace 6 meses pesa mucho menos que una de ayer.
function computeFrequencyScore(item, now) {
  if (!item.lastVisitedAt || item.visitCount === 0) return 0;
  const days = Math.max(daysSince(item.lastVisitedAt, now), 0);
  return item.visitCount / (1 + days);
}

// Función pura: ordena los ítems anclados por esa frecuencia real
// (innovación pedida explícitamente, en vez de dejar la lista crecer
// en el orden en que se anclaron) y marca como `suggestUnpin` los que
// no se han vuelto a visitar en `staleDays` — nunca los desancla solo,
// solo lo sugiere, la decisión la toma el usuario.
function rankPinnedItems(items, now = new Date(), { staleDays = DEFAULT_STALE_DAYS } = {}) {
  return items
    .map((item) => {
      const referenceDate = item.lastVisitedAt || item.pinnedAt;
      const daysSinceReference = daysSince(referenceDate, now);
      return {
        ...item,
        frequencyScore: computeFrequencyScore(item, now),
        suggestUnpin: daysSinceReference > staleDays,
      };
    })
    .sort((a, b) => {
      if (b.frequencyScore !== a.frequencyScore) return b.frequencyScore - a.frequencyScore;
      return new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime();
    });
}

module.exports = { computeFrequencyScore, rankPinnedItems, DEFAULT_STALE_DAYS };
