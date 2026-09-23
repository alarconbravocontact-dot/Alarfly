const { assertPeriodOpen, periodsOverlap } = require('./period-lock.rules');
const AppError = require('../utils/AppError');

describe('assertPeriodOpen (bloqueo de periodos cerrados)', () => {
  test('no lanza error si el periodo está abierto', () => {
    const period = { name: 'Enero 2026', status: 'OPEN' };
    expect(() => assertPeriodOpen(period)).not.toThrow();
  });

  test('lanza error si el periodo está cerrado', () => {
    const period = { name: 'Enero 2026', status: 'CLOSED' };
    expect(() => assertPeriodOpen(period)).toThrow(AppError);
    expect(() => assertPeriodOpen(period)).toThrow(/está cerrado/);
  });

  test('lanza error si el periodo no existe', () => {
    expect(() => assertPeriodOpen(null)).toThrow(/no existe/);
  });
});

describe('periodsOverlap', () => {
  const period = (startDate, endDate) => ({ startDate: new Date(startDate), endDate: new Date(endDate) });

  test('detecta periodos que se cruzan', () => {
    const a = period('2026-01-01', '2026-01-31');
    const b = period('2026-01-15', '2026-02-15');
    expect(periodsOverlap(a, b)).toBe(true);
  });

  test('no detecta cruce entre periodos consecutivos sin solapamiento', () => {
    const a = period('2026-01-01', '2026-01-31');
    const b = period('2026-02-01', '2026-02-28');
    expect(periodsOverlap(a, b)).toBe(false);
  });
});
