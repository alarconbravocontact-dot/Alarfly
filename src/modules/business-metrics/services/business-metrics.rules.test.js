const { computeMetricStats } = require('./business-metrics.rules');

describe('computeMetricStats', () => {
  it('devuelve todo en null si no hay registros', () => {
    const result = computeMetricStats([]);
    expect(result).toEqual({ count: 0, first: null, latest: null, average: null, min: null, max: null, total: null, change: null });
  });

  it('calcula promedio, mínimo, máximo y total correctamente', () => {
    const entries = [
      { date: '2026-07-01', value: '100' },
      { date: '2026-07-02', value: '300' },
      { date: '2026-07-03', value: '200' },
    ];
    const result = computeMetricStats(entries);
    expect(result.count).toBe(3);
    expect(result.average).toBe('200.0000');
    expect(result.min).toEqual({ date: '2026-07-01', value: '100.0000' });
    expect(result.max).toEqual({ date: '2026-07-02', value: '300.0000' });
    expect(result.total).toBe('600.0000');
  });

  it('calcula la variación entre el primer y el último registro', () => {
    const entries = [
      { date: '2026-07-01', value: '100' },
      { date: '2026-07-10', value: '150' },
    ];
    const result = computeMetricStats(entries);
    expect(result.first.value).toBe('100.0000');
    expect(result.latest.value).toBe('150.0000');
    expect(result.change).toEqual({ variance: '50.0000', variancePercent: '50.00' });
  });

  it('no divide entre cero si el primer valor es 0', () => {
    const entries = [
      { date: '2026-07-01', value: '0' },
      { date: '2026-07-02', value: '50' },
    ];
    const result = computeMetricStats(entries);
    expect(result.change.variance).toBe('50.0000');
    expect(result.change.variancePercent).toBeNull();
  });

  it('funciona con un solo registro (primer y último son el mismo)', () => {
    const entries = [{ date: '2026-07-01', value: '42' }];
    const result = computeMetricStats(entries);
    expect(result.count).toBe(1);
    expect(result.first).toEqual(result.latest);
    expect(result.change).toEqual({ variance: '0.0000', variancePercent: '0.00' });
  });
});
