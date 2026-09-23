const { evaluateFormula } = require('./formula-engine');

describe('evaluateFormula (motor de fórmulas seguro, sin eval)', () => {
  test('evalúa una expresión numérica simple', () => {
    expect(evaluateFormula('2 + 3 * 4', {}).toNumber()).toBe(14);
  });

  test('respeta paréntesis', () => {
    expect(evaluateFormula('(2 + 3) * 4', {}).toNumber()).toBe(20);
  });

  test('resuelve variables entre corchetes', () => {
    expect(evaluateFormula('[4135] * 0.05', { 4135: 10000 }).toNumber()).toBe(500);
  });

  test('resuelve una fórmula de margen bruto real', () => {
    const value = evaluateFormula('([4135] - [5310]) / [4135]', { 4135: 10000, 5310: 6000 });
    expect(value.toNumber()).toBeCloseTo(0.4);
  });

  test('permite negativos unarios', () => {
    expect(evaluateFormula('-[4135] + 100', { 4135: 40 }).toNumber()).toBe(60);
  });

  test('rechaza una variable desconocida', () => {
    expect(() => evaluateFormula('[9999] * 2', {})).toThrow('variable desconocida');
  });

  test('rechaza dividir entre cero', () => {
    expect(() => evaluateFormula('[4135] / 0', { 4135: 10 })).toThrow('dividir entre cero');
  });

  test('rechaza un carácter no permitido (ej: intento de inyección)', () => {
    expect(() => evaluateFormula('require("fs")', {})).toThrow('Fórmula inválida');
  });

  test('rechaza sintaxis incompleta', () => {
    expect(() => evaluateFormula('2 +', {})).toThrow('Fórmula inválida');
  });
});
