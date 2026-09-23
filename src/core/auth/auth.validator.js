const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email('Debe ser un correo válido.'),
  password: z.string().min(1, 'La contraseña es obligatoria.'),
});

const acceptInvitationSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
});

const verifyTwoFactorSchema = z.object({
  pendingToken: z.string().min(1),
  code: z.string().min(6, 'El código debe tener 6 dígitos.').max(6, 'El código debe tener 6 dígitos.'),
});

module.exports = { loginSchema, acceptInvitationSchema, verifyTwoFactorSchema };
