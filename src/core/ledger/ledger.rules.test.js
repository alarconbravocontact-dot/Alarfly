const { validateBalancedLines } = require('./ledger.rules');
const AppError = require('../utils/AppError');

describe('validateBalancedLines (partida doble)', () => {
  test('acepta un asiento balanceado con dos líneas', () => {
    const lines = [
      { accountId: 'a', debit: 100, credit: 0 },
      { accountId: 'b', debit: 0, credit: 100 },
    ];
    expect(() => validateBalancedLines(lines)).not.toThrow();
  });

  test('acepta un asiento balanceado con varias líneas de cada lado', () => {
    const lines = [
      { accountId: 'a', debit: 60, credit: 0 },
      { accountId: 'b', debit: 40, credit: 0 },
      { accountId: 'c', debit: 0, credit: 100 },
    ];
    expect(() => validateBalancedLines(lines)).not.toThrow();
  });

  test('rechaza un asiento donde débito no es igual a crédito', () => {
    const lines = [
      { accountId: 'a', debit: 100, credit: 0 },
      { accountId: 'b', debit: 0, credit: 90 },
    ];
    expect(() => validateBalancedLines(lines)).toThrow(AppError);
    expect(() => validateBalancedLines(lines)).toThrow(/no está balanceado/);
  });

  test('rechaza un asiento con menos de dos líneas', () => {
    const lines = [{ accountId: 'a', debit: 100, credit: 0 }];
    expect(() => validateBalancedLines(lines)).toThrow(/al menos dos líneas/);
  });

  test('rechaza una línea con débito y crédito al mismo tiempo', () => {
    const lines = [
      { accountId: 'a', debit: 50, credit: 50 },
      { accountId: 'b', debit: 0, credit: 50 },
    ];
    expect(() => validateBalancedLines(lines)).toThrow(/débito y en crédito a la vez/);
  });

  test('rechaza una línea sin monto en ningún lado', () => {
    const lines = [
      { accountId: 'a', debit: 0, credit: 0 },
      { accountId: 'b', debit: 0, credit: 100 },
    ];
    expect(() => validateBalancedLines(lines)).toThrow(/débito o en crédito/);
  });

  test('rechaza montos negativos', () => {
    const lines = [
      { accountId: 'a', debit: -10, credit: 0 },
      { accountId: 'b', debit: 0, credit: 10 },
    ];
    expect(() => validateBalancedLines(lines)).toThrow(/no pueden ser negativos/);
  });

  test('rechaza un asiento cuyo total es cero', () => {
    const lines = [
      { accountId: 'a', debit: 0, credit: 0 },
      { accountId: 'b', debit: 0, credit: 0 },
    ];
    expect(() => validateBalancedLines(lines)).toThrow();
  });

  test('maneja precisión decimal exacta (evita errores de punto flotante)', () => {
    const lines = [
      { accountId: 'a', debit: 0.1, credit: 0 },
      { accountId: 'b', debit: 0.2, credit: 0 },
      { accountId: 'c', debit: 0, credit: 0.3 },
    ];
    expect(() => validateBalancedLines(lines)).not.toThrow();
  });
});
