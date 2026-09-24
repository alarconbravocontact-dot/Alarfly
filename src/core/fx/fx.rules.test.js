const { calculateFxDifferential, assertBaseCurrencySettlement } = require('./fx.rules');

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

// Fase 6 (secciones 6/9/32): hace explícito y prueba el supuesto que ya
// estaba implícito en AR/AP/Órdenes de Pago/Deuda — liquidar una
// operación en una cuenta de tesorería que NO está en la moneda base
// de la empresa corrompía el saldo en silencio; ahora es un error claro.
describe('assertBaseCurrencySettlement', () => {
  test('no rechaza cuando la cuenta ya está en la moneda base', () => {
    expect(() =>
      assertBaseCurrencySettlement('USD', { name: 'Banco Principal', currency: 'USD' }, 'este cobro')
    ).not.toThrow();
  });

  test('rechaza con un mensaje claro cuando la cuenta está en otra moneda', () => {
    expect(() =>
      assertBaseCurrencySettlement('USD', { name: 'Cuenta en Bs.', currency: 'VES' }, 'este pago')
    ).toThrow(/Cuenta en Bs\..*VES.*este pago.*USD/);
  });

  test('el error trae el código SETTLEMENT_CURRENCY_MISMATCH', () => {
    try {
      assertBaseCurrencySettlement('USD', { name: 'Cuenta en Bs.', currency: 'VES' }, 'una deuda');
      throw new Error('no debió llegar acá');
    } catch (err) {
      expect(err.code).toBe('SETTLEMENT_CURRENCY_MISMATCH');
      expect(err.statusCode).toBe(400);
    }
  });
});
