const { signupSchema } = require('./auth.validator');

// Auditoría Post-Afiliados (hallazgo CRÍTICO): `referralCode` ganó
// `.nullable()` después de encontrar que CUALQUIER registro sin código
// de referido (el caso normal, la inmensa mayoría) fallaba con 400 —
// `AuthContext.signup` del frontend siempre manda la llave, con el
// código real o con `null` cuando `getStoredReferralCode()` no
// encontró ninguno. `.optional()` por sí solo nunca acepta `null`.
describe('signupSchema — referralCode (Fase Afiliados)', () => {
  test('acepta el body exacto que manda el frontend cuando NO hay código de referido (null explícito)', () => {
    const result = signupSchema.safeParse({
      companyName: 'Mi Negocio',
      name: 'Dueño',
      email: 'dueno@example.com',
      password: 'Prueba1234',
      referralCode: null,
    });
    expect(result.success).toBe(true);
  });

  test('acepta que la llave falte por completo (compatibilidad hacia atrás)', () => {
    const result = signupSchema.safeParse({
      companyName: 'Mi Negocio',
      name: 'Dueño',
      email: 'dueno@example.com',
      password: 'Prueba1234',
    });
    expect(result.success).toBe(true);
  });

  test('acepta un código real', () => {
    const result = signupSchema.safeParse({
      companyName: 'Mi Negocio',
      name: 'Dueño',
      email: 'dueno@example.com',
      password: 'Prueba1234',
      referralCode: 'AF-7K2M9X',
    });
    expect(result.success).toBe(true);
    expect(result.data.referralCode).toBe('AF-7K2M9X');
  });
});
