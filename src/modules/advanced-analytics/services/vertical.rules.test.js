const { calculateVerticalAnalysis } = require('./vertical.rules');

describe('calculateVerticalAnalysis', () => {
  test('calcula el % de cada fila sobre la base', () => {
    const rows = [
      { code: '1105', name: 'Caja', amount: 2000 },
      { code: '1110', name: 'Bancos', amount: 8000 },
    ];
    const result = calculateVerticalAnalysis(rows, 10000);
    expect(result[0].percentOfBase.toString()).toBe('20');
    expect(result[1].percentOfBase.toString()).toBe('80');
  });

  test('con base en cero, el % es 0 en vez de dividir entre cero', () => {
    const rows = [{ code: '1105', name: 'Caja', amount: 500 }];
    const result = calculateVerticalAnalysis(rows, 0);
    expect(result[0].percentOfBase.toString()).toBe('0');
  });

  test('no muta las filas originales, solo agrega el campo nuevo', () => {
    const rows = [{ code: '1105', name: 'Caja', amount: 500 }];
    const result = calculateVerticalAnalysis(rows, 1000);
    expect(result[0].code).toBe('1105');
    expect(result[0].amount).toBe(500);
  });
});
