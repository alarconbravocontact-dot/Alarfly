const { assertNoRateOverlap, findApplicableRate } = require('./tax-rates.rules');

describe('assertNoRateOverlap (vigencia de tasas)', () => {
  test('permite crear una tasa cuando no hay ninguna previa', () => {
    expect(() => assertNoRateOverlap([], { validFrom: new Date('2026-01-01'), validTo: null })).not.toThrow();
  });

  test('permite dos tasas consecutivas sin solape (una cierra donde empieza la otra + 1 día)', () => {
    const existing = [{ code: 'IVA_18', validFrom: new Date('2025-01-01'), validTo: new Date('2025-12-31') }];
    expect(() =>
      assertNoRateOverlap(existing, { validFrom: new Date('2026-01-01'), validTo: null })
    ).not.toThrow();
  });

  test('rechaza dos tasas activas (sin validTo) que se solapan', () => {
    const existing = [{ code: 'IVA_19', validFrom: new Date('2025-01-01'), validTo: null }];
    expect(() =>
      assertNoRateOverlap(existing, { validFrom: new Date('2026-01-01'), validTo: null })
    ).toThrow('se cruza con esta');
  });

  test('rechaza cuando la nueva tasa cae dentro del rango de una existente ya cerrada', () => {
    const existing = [{ code: 'IVA_18', validFrom: new Date('2025-01-01'), validTo: new Date('2025-12-31') }];
    expect(() =>
      assertNoRateOverlap(existing, { validFrom: new Date('2025-06-01'), validTo: new Date('2025-08-01') })
    ).toThrow('se cruza con esta');
  });
});

describe('findApplicableRate (resolución por vigencia)', () => {
  const rates = [
    { code: 'IVA_18', validFrom: new Date('2025-01-01'), validTo: new Date('2025-12-31') },
    { code: 'IVA_19', validFrom: new Date('2026-01-01'), validTo: null },
  ];

  test('devuelve la tasa vigente en una fecha histórica', () => {
    expect(findApplicableRate(rates, new Date('2025-06-15')).code).toBe('IVA_18');
  });

  test('devuelve la tasa vigente actual (sin validTo)', () => {
    expect(findApplicableRate(rates, new Date('2026-07-01')).code).toBe('IVA_19');
  });

  test('devuelve null si no hay ninguna tasa vigente en esa fecha', () => {
    expect(findApplicableRate(rates, new Date('2024-01-01'))).toBeNull();
  });
});
