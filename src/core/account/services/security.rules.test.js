const { assertStrongPassword, isStrongPassword } = require('./security.rules');

describe('assertStrongPassword', () => {
  test('acepta una contraseña que cumple las 4 reglas', () => {
    expect(assertStrongPassword('Clave1234')).toEqual([]);
  });

  test('rechaza una contraseña demasiado corta', () => {
    expect(assertStrongPassword('Ab1')).toContain('al menos 8 caracteres');
  });

  test('rechaza una contraseña sin mayúscula', () => {
    expect(assertStrongPassword('clave1234')).toContain('una letra mayúscula');
  });

  test('rechaza una contraseña sin minúscula', () => {
    expect(assertStrongPassword('CLAVE1234')).toContain('una letra minúscula');
  });

  test('rechaza una contraseña sin número', () => {
    expect(assertStrongPassword('ClaveClave')).toContain('un número');
  });

  test('acumula todos los problemas a la vez', () => {
    expect(assertStrongPassword('abc')).toHaveLength(3); // corta + sin mayúscula + sin número
  });
});

describe('isStrongPassword', () => {
  test('true cuando no hay problemas', () => {
    expect(isStrongPassword('Clave1234')).toBe(true);
  });

  test('false cuando hay al menos un problema', () => {
    expect(isStrongPassword('clave')).toBe(false);
  });
});
