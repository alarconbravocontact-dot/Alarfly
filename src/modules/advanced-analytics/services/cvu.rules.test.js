const { projectCvuScenarios } = require('./cvu.rules');

describe('projectCvuScenarios', () => {
  const base = { totalRevenue: 10000, fixedCosts: 2000, variableCosts: 6000 };

  test('el multiplicador 1 reproduce exactamente la utilidad actual', () => {
    const scenarios = projectCvuScenarios({ ...base, volumeMultipliers: ['1'] });
    // Utilidad actual = 10000 - 6000 - 2000 = 2000
    expect(scenarios[0].projectedProfit.toString()).toBe('2000');
  });

  test('el costo fijo se mantiene constante en todos los escenarios', () => {
    const scenarios = projectCvuScenarios(base);
    scenarios.forEach((s) => expect(s.fixedCosts.toString()).toBe('2000'));
  });

  test('el ingreso y el costo variable escalan proporcionalmente al volumen', () => {
    const scenarios = projectCvuScenarios({ ...base, volumeMultipliers: ['0.5', '2'] });
    expect(scenarios[0].projectedRevenue.toString()).toBe('5000');
    expect(scenarios[0].projectedVariableCosts.toString()).toBe('3000');
    expect(scenarios[1].projectedRevenue.toString()).toBe('20000');
    expect(scenarios[1].projectedVariableCosts.toString()).toBe('12000');
  });

  test('a más volumen, más utilidad, cuando el margen de contribución es positivo', () => {
    const scenarios = projectCvuScenarios({ ...base, volumeMultipliers: ['0.5', '1', '1.5'] });
    expect(scenarios[0].projectedProfit.lessThan(scenarios[1].projectedProfit)).toBe(true);
    expect(scenarios[1].projectedProfit.lessThan(scenarios[2].projectedProfit)).toBe(true);
  });

  test('usa los multiplicadores por defecto si no se indican', () => {
    const scenarios = projectCvuScenarios(base);
    expect(scenarios).toHaveLength(5);
  });
});
