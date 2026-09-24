const { assertDifferentActors } = require('./segregation.rules');
const AppError = require('../utils/AppError');

describe('assertDifferentActors (segregación de funciones compartida — Fase 11)', () => {
  test('no lanza error si el solicitante y el que actúa son distintos', () => {
    expect(() => assertDifferentActors('user-1', 'user-2', { message: 'no permitido' })).not.toThrow();
  });

  test('lanza AppError 403 si es la misma persona', () => {
    expect(() => assertDifferentActors('user-1', 'user-1', { message: 'no permitido' })).toThrow(AppError);
    try {
      assertDifferentActors('user-1', 'user-1', { message: 'mensaje específico' });
    } catch (err) {
      expect(err.statusCode).toBe(403);
      expect(err.message).toBe('mensaje específico');
      expect(err.code).toBe('SELF_APPROVAL_FORBIDDEN');
    }
  });

  test('permite un código de error propio por dominio', () => {
    try {
      assertDifferentActors('a', 'a', { message: 'x', code: 'SAME_USER_APPROVAL' });
    } catch (err) {
      expect(err.code).toBe('SAME_USER_APPROVAL');
    }
  });
});
