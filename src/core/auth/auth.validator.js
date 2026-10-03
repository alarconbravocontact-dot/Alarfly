const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email('Debe ser un correo válido.'),
  password: z.string().min(1, 'La contraseña es obligatoria.'),
});

const acceptInvitationSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
});

// Fase Landing — Registro Público: la fortaleza real de la contraseña
// (mayúscula/minúscula/número) se revalida en el servicio con la
// misma función pura que ya usa Mi Cuenta (security.rules.js) — acá
// solo se exige el mínimo de longitud para dar un mensaje de Zod
// razonable antes de llegar a esa validación más completa.
const signupSchema = z.object({
  companyName: z.string().min(1, 'El nombre de la empresa es obligatorio.'),
  name: z.string().min(1, 'Tu nombre es obligatorio.'),
  email: z.string().email('Debe ser un correo válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
  // Fase Afiliados: opcional — ver auth.service.signup. Nunca se
  // valida que el código exista acá (eso es responsabilidad del
  // servicio, que lo trata como mejor-esfuerzo); acá solo se limita el
  // tamaño para no aceptar basura arbitraria en el body.
  //
  // Auditoría Post-Afiliados (hallazgo CRÍTICO, corregido acá): `.optional()`
  // en Zod solo acepta que la llave esté AUSENTE (`undefined`), nunca un
  // `null` explícito. El frontend (AuthContext.signup) siempre manda la
  // llave — con el valor real o con `null` cuando `getStoredReferralCode()`
  // no encontró ningún código guardado (el caso normal: la inmensa
  // mayoría de los registros no vienen de un enlace de afiliado). Sin
  // `.nullable()`, CADA registro sin código de referido fallaba con 400
  // ("Expected string, received null") — rompiendo el embudo de registro
  // público completo, no solo el camino de afiliados. Encontrado en
  // esta auditoría con Playwright (un registro común, sin tocar nada de
  // afiliados, ya fallaba) y confirmado con `curl` que el mismo registro
  // SIN la llave `referralCode` en el body sí funcionaba.
  referralCode: z.string().max(40).nullable().optional(),
});

const verifyTwoFactorSchema = z.object({
  pendingToken: z.string().min(1),
  code: z.string().min(6, 'El código debe tener 6 dígitos.').max(6, 'El código debe tener 6 dígitos.'),
});

module.exports = { loginSchema, acceptInvitationSchema, verifyTwoFactorSchema, signupSchema };
