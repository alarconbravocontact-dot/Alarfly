const { computeTrendStats } = require('./trend-analysis.rules');

describe('computeTrendStats', () => {
  test('calcula promedio, mínimo, máximo y variación entre el primer y el último punto', () => {
    const points = [
      { period: '2026-01', value: 1000 },
      { period: '2026-02', value: 2000 },
      { period: '2026-03', value: 1500 },
    ];
    const stats = computeTrendStats(points);
    expect(stats.average.toString()).toBe('1500');
    expect(stats.min.toString()).toBe('1000');
    expect(stats.max.toString()).toBe('2000');
    expect(stats.growthPercent.toString()).toBe('50');
  });

  test('serie vacía → todo null, sin lanzar error', () => {
    const stats = computeTrendStats([]);
    expect(stats.average).toBeNull();
    expect(stats.growthPercent).toBeNull();
  });

  test('primer valor en cero → variación null en vez de dividir entre cero', () => {
    const stats = computeTrendStats([
      { period: '2026-01', value: 0 },
      { period: '2026-02', value: 500 },
    ]);
    expect(stats.growthPercent).toBeNull();
  });

  test('un solo punto: promedio, mínimo y máximo son ese mismo valor, sin variación', () => {
    const stats = computeTrendStats([{ period: '2026-01', value: 700 }]);
    expect(stats.average.toString()).toBe('700');
    expect(stats.min.toString()).toBe('700');
    expect(stats.max.toString()).toBe('700');
    expect(stats.growthPercent.toString()).toBe('0');
  });
});
