const { encrypt, decrypt } = require('./crypto');

describe('crypto (AES-256-GCM)', () => {
  test('descifra exactamente lo que se cifró', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const encrypted = encrypt(secret);
    expect(decrypt(encrypted)).toBe(secret);
  });

  test('el texto cifrado nunca contiene el texto plano', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    expect(encrypt(secret)).not.toContain(secret);
  });

  test('dos cifrados del mismo texto son distintos (IV aleatorio)', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    expect(encrypt(secret)).not.toBe(encrypt(secret));
  });

  test('rechaza un texto cifrado alterado (autenticación falla)', () => {
    const encrypted = encrypt('JBSWY3DPEHPK3PXP');
    const lastChar = encrypted.slice(-1);
    const differentChar = lastChar === '0' ? '1' : '0'; // garantiza un cambio real, sin depender de qué carácter salió al azar
    const tampered = encrypted.slice(0, -1) + differentChar;
    expect(() => decrypt(tampered)).toThrow();
  });
});
