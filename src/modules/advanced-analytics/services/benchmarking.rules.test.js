const { compareToBenchmark } = require('./benchmarking.rules');

describe('compareToBenchmark', () => {
  test('valor real por encima del benchmark', () => {
    const result = compareToBenchmark({ actualValue: 25, benchmarkValue: 20 });
    expect(result.variance.toString()).toBe('5');
    expect(result.variancePercent.toString()).toBe('25');
    expect(result.isAboveBenchmark).toBe(true);
  });

  test('valor real por debajo del benchmark', () => {
    const result = compareToBenchmark({ actualValue: 10, benchmarkValue: 20 });
    expect(result.variance.toString()).toBe('-10');
    expect(result.isAboveBenchmark).toBe(false);
  });

  test('benchmark en cero → variancePercent null en vez de dividir entre cero', () => {
    const result = compareToBenchmark({ actualValue: 10, benchmarkValue: 0 });
    expect(result.variancePercent).toBeNull();
    expect(result.variance.toString()).toBe('10');
  });
});
