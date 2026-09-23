const { assertSixPartContract } = require('./analysis-engine.service');

function validResult(overrides = {}) {
  return {
    numericResult: { value: 100 },
    chartType: 'TREND_LINE',
    chartData: [{ x: 1, y: 2 }],
    causeExplanation: 'Porque sí.',
    simpleInterpretation: 'Significa esto.',
    methodology: 'Se calculó así.',
    recommendations: [{ text: 'Haz esto.', quantifiedType: 'NONE', quantifiedValue: null, isPrimary: true }],
    ...overrides,
  };
}

describe('assertSixPartContract', () => {
  test('no lanza error con un resultado completo', () => {
    expect(() => assertSixPartContract('BREAK_EVEN', validResult())).not.toThrow();
  });

  test.each([
    ['numericResult', null],
    ['numericResult', undefined],
    ['chartType', 'PIE_3D'],
    ['chartData', []],
    ['chartData', null],
    ['causeExplanation', ''],
    ['causeExplanation', null],
    ['simpleInterpretation', ''],
    ['methodology', ''],
    ['recommendations', []],
    ['recommendations', null],
  ])('rechaza cuando "%s" es %p', (field, value) => {
    expect(() => assertSixPartContract('BREAK_EVEN', validResult({ [field]: value }))).toThrow('no devolvió un resultado completo');
  });

  test('rechaza un resultado vacío por completo', () => {
    expect(() => assertSixPartContract('BREAK_EVEN', null)).toThrow();
    expect(() => assertSixPartContract('BREAK_EVEN', {})).toThrow();
  });
});
