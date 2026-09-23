const { calculateEbitda, calculateBurnRate, calculateRunway } = require('./kpi.rules');

describe('calculateEbitda', () => {
  test('suma intereses y depreciación/amortización a la utilidad neta', () => {
    const ebitda = calculateEbitda({ netIncome: 1000, interestExpense: 200, depreciationAndAmortization: 300 });
    expect(ebitda.toNumber()).toBe(1500);
  });

  test('funciona con utilidad neta negativa', () => {
    const ebitda = calculateEbitda({ netIncome: -500, interestExpense: 100, depreciationAndAmortization: 200 });
    expect(ebitda.toNumber()).toBe(-200);
  });
});

describe('calculateBurnRate', () => {
  test('utilidad neta positiva: no se está quemando caja (0)', () => {
    expect(calculateBurnRate({ netIncome: 500, months: 3 }).toNumber()).toBe(0);
  });

  test('pérdida neta: burn rate es el promedio mensual de la pérdida', () => {
    expect(calculateBurnRate({ netIncome: -900, months: 3 }).toNumber()).toBe(300);
  });

  test('rechaza un periodo de 0 meses', () => {
    expect(() => calculateBurnRate({ netIncome: -900, months: 0 })).toThrow('al menos un mes');
  });
});

describe('calculateRunway', () => {
  test('con burn rate positivo, calcula los meses de colchón disponibles', () => {
    expect(calculateRunway({ liquidityCushion: 6000, monthlyBurnRate: 1000 }).toNumber()).toBe(6);
  });

  test('sin quema de caja (burn rate 0), el runway no aplica (null)', () => {
    expect(calculateRunway({ liquidityCushion: 6000, monthlyBurnRate: 0 })).toBeNull();
  });
});
