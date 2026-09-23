const { buildWeeklyBuckets, buildLiquidityForecast, findFirstNegativeWeek } = require('./liquidity-forecast.rules');

describe('buildWeeklyBuckets', () => {
  test('arma semanas consecutivas de 7 días sin huecos ni solapes', () => {
    const buckets = buildWeeklyBuckets(new Date('2026-07-06T00:00:00Z'), 3);
    expect(buckets).toHaveLength(3);
    expect(buckets[0]).toEqual({ weekStart: new Date('2026-07-06T00:00:00Z'), weekEnd: new Date('2026-07-12T00:00:00Z') });
    expect(buckets[1]).toEqual({ weekStart: new Date('2026-07-13T00:00:00Z'), weekEnd: new Date('2026-07-19T00:00:00Z') });
    expect(buckets[2]).toEqual({ weekStart: new Date('2026-07-20T00:00:00Z'), weekEnd: new Date('2026-07-26T00:00:00Z') });
  });
});

describe('buildLiquidityForecast', () => {
  const buckets = buildWeeklyBuckets(new Date('2026-07-06T00:00:00Z'), 2);

  test('acumula el saldo proyectado semana a semana a partir del saldo inicial', () => {
    const movements = [
      { date: new Date('2026-07-08T00:00:00Z'), amount: 1000 }, // entrada semana 1
      { date: new Date('2026-07-10T00:00:00Z'), amount: -400 }, // salida semana 1
      { date: new Date('2026-07-15T00:00:00Z'), amount: -800 }, // salida semana 2
    ];
    const forecast = buildLiquidityForecast(500, buckets, movements);

    expect(forecast[0].expectedInflows).toBe('1000.00');
    expect(forecast[0].expectedOutflows).toBe('400.00');
    expect(forecast[0].netChange).toBe('600.00');
    expect(forecast[0].projectedBalance).toBe('1100.00'); // 500 + 600

    expect(forecast[1].expectedOutflows).toBe('800.00');
    expect(forecast[1].projectedBalance).toBe('300.00'); // 1100 - 800
  });

  test('una semana sin movimientos mantiene el saldo igual', () => {
    const forecast = buildLiquidityForecast(1000, buckets, []);
    expect(forecast[0].projectedBalance).toBe('1000.00');
    expect(forecast[1].projectedBalance).toBe('1000.00');
  });
});

describe('findFirstNegativeWeek', () => {
  test('encuentra la primera semana con saldo proyectado negativo', () => {
    const weeks = [
      { weekStart: 'w1', projectedBalance: '500.00' },
      { weekStart: 'w2', projectedBalance: '-100.00' },
      { weekStart: 'w3', projectedBalance: '-900.00' },
    ];
    expect(findFirstNegativeWeek(weeks).weekStart).toBe('w2');
  });

  test('devuelve null si nunca se vuelve negativo', () => {
    const weeks = [{ projectedBalance: '500.00' }, { projectedBalance: '200.00' }];
    expect(findFirstNegativeWeek(weeks)).toBeNull();
  });
});
