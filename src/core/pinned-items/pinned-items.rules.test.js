const { computeFrequencyScore, rankPinnedItems } = require('./pinned-items.rules');

const NOW = new Date('2026-07-20T12:00:00Z');

describe('computeFrequencyScore', () => {
  test('0 si nunca se visitó', () => {
    expect(computeFrequencyScore({ visitCount: 0, lastVisitedAt: null }, NOW)).toBe(0);
  });

  test('más alto cuanto más reciente la última visita, a igual cantidad de visitas', () => {
    const recent = computeFrequencyScore({ visitCount: 10, lastVisitedAt: '2026-07-19T12:00:00Z' }, NOW);
    const old = computeFrequencyScore({ visitCount: 10, lastVisitedAt: '2026-06-01T12:00:00Z' }, NOW);
    expect(recent).toBeGreaterThan(old);
  });

  test('más alto cuantas más visitas, a igual fecha', () => {
    const frequent = computeFrequencyScore({ visitCount: 20, lastVisitedAt: '2026-07-15T12:00:00Z' }, NOW);
    const rare = computeFrequencyScore({ visitCount: 2, lastVisitedAt: '2026-07-15T12:00:00Z' }, NOW);
    expect(frequent).toBeGreaterThan(rare);
  });
});

describe('rankPinnedItems', () => {
  test('ordena por frecuencia real, no por orden de anclado', () => {
    const items = [
      { id: 'old-frequent', pinnedAt: '2026-01-01T00:00:00Z', visitCount: 15, lastVisitedAt: '2026-07-19T00:00:00Z' },
      { id: 'new-unused', pinnedAt: '2026-07-19T00:00:00Z', visitCount: 0, lastVisitedAt: null },
    ];
    const ranked = rankPinnedItems(items, NOW);
    expect(ranked.map((i) => i.id)).toEqual(['old-frequent', 'new-unused']);
  });

  test('entre dos nunca visitados, desempata por el anclado más reciente', () => {
    const items = [
      { id: 'pinned-early', pinnedAt: '2026-06-01T00:00:00Z', visitCount: 0, lastVisitedAt: null },
      { id: 'pinned-late', pinnedAt: '2026-07-18T00:00:00Z', visitCount: 0, lastVisitedAt: null },
    ];
    const ranked = rankPinnedItems(items, NOW);
    expect(ranked.map((i) => i.id)).toEqual(['pinned-late', 'pinned-early']);
  });

  test('marca suggestUnpin cuando pasaron más de staleDays sin visitarse', () => {
    const items = [
      { id: 'stale', pinnedAt: '2026-01-01T00:00:00Z', visitCount: 3, lastVisitedAt: '2026-05-01T00:00:00Z' },
      { id: 'fresh', pinnedAt: '2026-01-01T00:00:00Z', visitCount: 3, lastVisitedAt: '2026-07-18T00:00:00Z' },
    ];
    const ranked = rankPinnedItems(items, NOW);
    const stale = ranked.find((i) => i.id === 'stale');
    const fresh = ranked.find((i) => i.id === 'fresh');
    expect(stale.suggestUnpin).toBe(true);
    expect(fresh.suggestUnpin).toBe(false);
  });

  test('un ítem nunca visitado también puede quedar viejo (por fecha de anclado)', () => {
    const items = [{ id: 'never-visited-old', pinnedAt: '2026-01-01T00:00:00Z', visitCount: 0, lastVisitedAt: null }];
    const ranked = rankPinnedItems(items, NOW);
    expect(ranked[0].suggestUnpin).toBe(true);
  });

  test('respeta un staleDays configurado', () => {
    const items = [{ id: 'x', pinnedAt: NOW, visitCount: 1, lastVisitedAt: '2026-07-15T00:00:00Z' }];
    const ranked = rankPinnedItems(items, NOW, { staleDays: 3 });
    expect(ranked[0].suggestUnpin).toBe(true);
  });
});
