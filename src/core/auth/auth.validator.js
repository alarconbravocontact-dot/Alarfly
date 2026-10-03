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
  referralCode: z.string().max(40).optional(),
});

const verifyTwoFactorSchema = z.object({
  pendingToken: z.string().min(1),
  code: z.string().min(6, 'El código debe tener 6 dígitos.').max(6, 'El código debe tener 6 dígitos.'),
});

module.exports = { loginSchema, acceptInvitationSchema, verifyTwoFactorSchema, signupSchema };
