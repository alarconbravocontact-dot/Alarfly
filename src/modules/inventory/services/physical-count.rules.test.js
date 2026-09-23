const { calculateCountDifference, assertCanApproveCount } = require('./physical-count.rules');

describe('calculateCountDifference', () => {
  test('positivo cuando hay sobrante', () => {
    expect(calculateCountDifference(10, 12).toFixed(2)).toBe('2.00');
  });
  test('negativo cuando hay faltante', () => {
    expect(calculateCountDifference(10, 7).toFixed(2)).toBe('-3.00');
  });
  test('cero cuando coincide', () => {
    expect(calculateCountDifference(10, 10).toFixed(2)).toBe('0.00');
  });
});

describe('assertCanApproveCount', () => {
  test('rechaza si quien aprueba es quien contó (mismo usuario)', () => {
    const count = { status: 'PENDING_APPROVAL', countedByUserId: 'user1' };
    expect(() => assertCanApproveCount(count, 'user1')).toThrow('no puede aprobar su propio ajuste');
  });

  test('permite si es un usuario distinto y el conteo está pendiente', () => {
    const count = { status: 'PENDING_APPROVAL', countedByUserId: 'user1' };
    expect(() => assertCanApproveCount(count, 'user2')).not.toThrow();
  });

  test('rechaza si el conteo no está pendiente de aprobación', () => {
    const count = { status: 'APPROVED', countedByUserId: 'user1' };
    expect(() => assertCanApproveCount(count, 'user2')).toThrow('no está pendiente de aprobación');
  });
});
