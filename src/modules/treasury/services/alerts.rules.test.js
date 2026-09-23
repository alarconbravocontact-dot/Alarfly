const {
  detectLowBalance,
  detectCreditCardNearLimit,
  detectPaymentDueSoon,
  severityForPaymentDueSoon,
  detectRecurringLateCustomer,
} = require('./alerts.rules');

describe('detectLowBalance', () => {
  test('detecta saldo por debajo del umbral', () => {
    expect(detectLowBalance(400, 500)).toBe(true);
  });

  test('no alerta si el saldo está en o por encima del umbral', () => {
    expect(detectLowBalance(500, 500)).toBe(false);
    expect(detectLowBalance(600, 500)).toBe(false);
  });

  test('no alerta si no hay umbral configurado', () => {
    expect(detectLowBalance(0, null)).toBe(false);
    expect(detectLowBalance(0, undefined)).toBe(false);
  });
});

describe('detectCreditCardNearLimit', () => {
  test('alerta cuando el uso llega al porcentaje configurado', () => {
    expect(detectCreditCardNearLimit(900, 1000, 90)).toBe(true);
    expect(detectCreditCardNearLimit(950, 1000, 90)).toBe(true);
  });

  test('no alerta por debajo del porcentaje', () => {
    expect(detectCreditCardNearLimit(800, 1000, 90)).toBe(false);
  });

  test('no alerta si la tarjeta no tiene límite configurado', () => {
    expect(detectCreditCardNearLimit(900, null, 90)).toBe(false);
  });
});

describe('detectPaymentDueSoon / severityForPaymentDueSoon', () => {
  test('alerta cuando el vencimiento está dentro de la ventana de días', () => {
    expect(detectPaymentDueSoon('2026-07-15', '2026-07-13', 3)).toBe(true);
  });

  test('no alerta si el vencimiento está lejos', () => {
    expect(detectPaymentDueSoon('2026-08-01', '2026-07-13', 3)).toBe(false);
  });

  test('alerta (con severidad crítica) si ya está vencido', () => {
    expect(detectPaymentDueSoon('2026-07-10', '2026-07-13', 3)).toBe(true);
    expect(severityForPaymentDueSoon('2026-07-10', '2026-07-13')).toBe('CRITICAL');
  });

  test('severidad es WARNING si todavía no vence', () => {
    expect(severityForPaymentDueSoon('2026-07-15', '2026-07-13')).toBe('WARNING');
  });
});

describe('detectRecurringLateCustomer', () => {
  test('alerta cuando el cliente llega o supera el umbral de facturas vencidas', () => {
    expect(detectRecurringLateCustomer(2, 2)).toBe(true);
    expect(detectRecurringLateCustomer(3, 2)).toBe(true);
  });

  test('no alerta con una sola factura vencida (no es "recurrente")', () => {
    expect(detectRecurringLateCustomer(1, 2)).toBe(false);
  });

  test('no alerta sin facturas vencidas', () => {
    expect(detectRecurringLateCustomer(0, 2)).toBe(false);
  });
});
