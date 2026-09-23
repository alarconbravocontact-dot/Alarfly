const { calculateFxDifferential } = require('./fx.rules');

describe('calculateFxDifferential', () => {
  test('detecta una ganancia cambiaria (la moneda extranjera subió de valor)', () => {
    // 1000 USD registrados originalmente a 1.00 (base = 1000), ahora la
    // tasa subió a 1.10: deberían valer 1100 en libros.
    const { differential, shouldBeBaseBalance } = calculateFxDifferential(1000, 1000, 1.1);
    expect(shouldBeBaseBalance.toFixed(2)).toBe('1100.00');
    expect(differential.toFixed(2)).toBe('100.00');
    expect(differential.isPositive()).toBe(true);
  });

  test('detecta una pérdida cambiaria (la moneda extranjera bajó de valor)', () => {
    const { differential } = calculateFxDifferential(1000, 1000, 0.9);
    expect(differential.toFixed(2)).toBe('-100.00');
    expect(differential.isNegative()).toBe(true);
  });

  test('no hay diferencial si la tasa no cambió', () => {
    const { differential } = calculateFxDifferential(500, 500, 1);
    expect(differential.isZero()).toBe(true);
  });

  test('funciona con saldos negativos (cuentas de tipo pasivo)', () => {
    // Un pasivo en moneda extranjera de -1000 (saldo acreedor) con la
    // tasa subiendo también genera diferencial.
    const { differential } = calculateFxDifferential(-1000, -1000, 1.2);
    expect(differential.toFixed(2)).toBe('-200.00');
  });
});
