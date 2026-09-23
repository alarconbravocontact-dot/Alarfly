const { assertQuotaAvailable } = require('./rbac.rules');

describe('assertQuotaAvailable', () => {
  test('no bloquea ADMIN, que no tiene límite', () => {
    expect(() => assertQuotaAvailable('ADMIN', 999)).not.toThrow();
  });

  test('permite asignar el rol si todavía hay cupo', () => {
    expect(() => assertQuotaAvailable('ACCOUNTANT', 2)).not.toThrow();
  });

  test('rechaza si ya se alcanzó el cupo máximo', () => {
    expect(() => assertQuotaAvailable('ACCOUNTANT', 3)).toThrow('3 de 3 cupos ocupados');
  });

  test('rechaza si ya se superó el cupo (defensivo)', () => {
    try {
      assertQuotaAvailable('COLLABORATOR', 9);
      throw new Error('debía lanzar');
    } catch (err) {
      expect(err.code).toBe('ROLE_QUOTA_EXCEEDED');
    }
  });

  test('respeta el cupo de FINANCE (4)', () => {
    expect(() => assertQuotaAvailable('FINANCE', 3)).not.toThrow();
    expect(() => assertQuotaAvailable('FINANCE', 4)).toThrow();
  });
});
