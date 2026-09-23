const { findAutomaticMatches, daysBetween } = require('./reconciliation.rules');

const tx = (id, date, amount) => ({ id, date, amount });
const line = (id, date, debit = 0, credit = 0) => ({ id, date, debit, credit });

describe('findAutomaticMatches (motor de conciliación)', () => {
  test('empareja monto exacto y misma fecha', () => {
    const bankTransactions = [tx('t1', '2026-07-05', 150)];
    const lines = [line('l1', '2026-07-05', 150, 0)];

    const matches = findAutomaticMatches(bankTransactions, lines);

    expect(matches).toEqual([{ bankTransactionId: 't1', journalEntryLineId: 'l1', dayDiff: 0 }]);
  });

  test('empareja dentro de la tolerancia de días configurada', () => {
    const bankTransactions = [tx('t1', '2026-07-08', 200)];
    const lines = [line('l1', '2026-07-05', 200, 0)];

    const matches = findAutomaticMatches(bankTransactions, lines, { toleranceDays: 5 });

    expect(matches).toHaveLength(1);
    expect(matches[0].dayDiff).toBe(3);
  });

  test('no empareja si la diferencia de fecha supera la tolerancia', () => {
    const bankTransactions = [tx('t1', '2026-07-20', 200)];
    const lines = [line('l1', '2026-07-05', 200, 0)];

    const matches = findAutomaticMatches(bankTransactions, lines, { toleranceDays: 3 });

    expect(matches).toHaveLength(0);
  });

  test('no empareja si el monto no coincide', () => {
    const bankTransactions = [tx('t1', '2026-07-05', 150)];
    const lines = [line('l1', '2026-07-05', 100, 0)];

    const matches = findAutomaticMatches(bankTransactions, lines);

    expect(matches).toHaveLength(0);
  });

  test('respeta una tolerancia de monto configurada', () => {
    const bankTransactions = [tx('t1', '2026-07-05', 150.05)];
    const lines = [line('l1', '2026-07-05', 150, 0)];

    const matches = findAutomaticMatches(bankTransactions, lines, { amountTolerance: 0.1 });

    expect(matches).toHaveLength(1);
  });

  test('no adivina si hay dos candidatos igual de cercanos (ambigüedad)', () => {
    const bankTransactions = [tx('t1', '2026-07-05', 100)];
    const lines = [line('l1', '2026-07-04', 100, 0), line('l2', '2026-07-06', 100, 0)];

    const matches = findAutomaticMatches(bankTransactions, lines);

    expect(matches).toHaveLength(0);
  });

  test('prefiere el candidato más cercano en fecha cuando no hay empate', () => {
    const bankTransactions = [tx('t1', '2026-07-05', 100)];
    const lines = [line('l1', '2026-07-01', 100, 0), line('l2', '2026-07-06', 100, 0)];

    const matches = findAutomaticMatches(bankTransactions, lines, { toleranceDays: 10 });

    expect(matches).toEqual([{ bankTransactionId: 't1', journalEntryLineId: 'l2', dayDiff: 1 }]);
  });

  test('no usa la misma línea del mayor para dos movimientos distintos', () => {
    const bankTransactions = [tx('t1', '2026-07-05', 100), tx('t2', '2026-07-05', 100)];
    const lines = [line('l1', '2026-07-05', 100, 0)];

    const matches = findAutomaticMatches(bankTransactions, lines);

    expect(matches).toHaveLength(1);
    expect(matches[0].bankTransactionId).toBe('t1');
  });

  test('un movimiento de salida (crédito en libros) empareja contra su monto negativo', () => {
    const bankTransactions = [tx('t1', '2026-07-05', -80)];
    const lines = [line('l1', '2026-07-05', 0, 80)];

    const matches = findAutomaticMatches(bankTransactions, lines);

    expect(matches).toHaveLength(1);
  });
});

describe('daysBetween', () => {
  test('calcula la diferencia en días entre dos fechas', () => {
    expect(daysBetween('2026-07-10', '2026-07-05')).toBe(5);
    expect(daysBetween('2026-07-05', '2026-07-10')).toBe(-5);
  });
});
