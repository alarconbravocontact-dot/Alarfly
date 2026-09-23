const { resolveEscalationLevel } = require('./ar-collections.rules');

describe('resolveEscalationLevel', () => {
  const levels = [
    { daysOverdue: 7, severity: 'INFO', action: 'REMINDER' },
    { daysOverdue: 15, severity: 'WARNING', action: 'FIRM_NOTICE' },
    { daysOverdue: 30, severity: 'CRITICAL', action: 'BLOCK' },
  ];

  test('devuelve null si todavía no llega al primer nivel', () => {
    expect(resolveEscalationLevel(5, levels)).toBeNull();
  });

  test('devuelve el primer nivel justo al cruzar su umbral', () => {
    expect(resolveEscalationLevel(7, levels).action).toBe('REMINDER');
  });

  test('devuelve el nivel intermedio cuando corresponde', () => {
    expect(resolveEscalationLevel(20, levels).action).toBe('FIRM_NOTICE');
  });

  test('devuelve el nivel más severo (crítico) cuando se supera su umbral', () => {
    expect(resolveEscalationLevel(45, levels).action).toBe('BLOCK');
  });

  test('no importa el orden en que vengan los niveles', () => {
    const shuffled = [levels[2], levels[0], levels[1]];
    expect(resolveEscalationLevel(20, shuffled).action).toBe('FIRM_NOTICE');
  });

  test('devuelve null si la lista de niveles está vacía', () => {
    expect(resolveEscalationLevel(100, [])).toBeNull();
  });
});
