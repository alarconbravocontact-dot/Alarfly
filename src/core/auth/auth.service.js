const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../database/prisma');
const config = require('../config');
const AppError = require('../utils/AppError');
const auditService = require('../audit/audit.service');
const { assertQuotaAvailable } = require('../rbac/rbac.rules');
const { decrypt } = require('../utils/crypto');

const PENDING_2FA_EXPIRES_IN = '5m';

// F15-E3: sin ninguna protección contra fuerza bruta hasta ahora —
// login() nunca limitaba intentos. 5 fallos consecutivos bloquean la
// cuenta 15 minutos; un login correcto reinicia el contador. Acotado a
// la propia cuenta (no por IP): es el mismo trade-off que usa la
// mayoría de sistemas de login (alguien podría bloquear a otro a
// propósito adivinando mal su contraseña), documentado como límite
// conocido — sigue siendo estrictamente mejor que no tener ninguna
// protección, que era el estado real hasta este punto.
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

// companyIdOverride: usado por core/account (selector de empresa
// activa, Mi Cuenta punto 5) para reemitir el token con otra empresa
// sin crear una sesión nueva. El rol del usuario NO cambia por
// empresa en este modelo de datos (User.role es un solo valor, no por
// UserCompanyAccess) — simplificación consciente, documentada en
// core/account/services/companies.service.js.
function buildSession(user, sessionId, companyIdOverride) {
  const companyId = companyIdOverride || user.companyId;
  const token = jwt.sign({ userId: user.id, companyId, role: user.role, sessionId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId },
  };
}

// Sesión real (Mi Cuenta, punto 7): una fila por inicio de sesión, para
// poder listarla y cerrarla en remoto de verdad — no solo un JWT sin
// estado. requireAuth valida en cada petición que siga sin revocar.
async function createSession(userId, { deviceInfo, ipAddress } = {}) {
  return prisma.userSession.create({ data: { userId, deviceInfo, ipAddress } });
}

async function login(email, password, { deviceInfo, ipAddress } = {}) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.isActive) {
    throw new AppError('Correo o contraseña incorrectos.', 401, 'INVALID_CREDENTIALS');
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError(
      'Demasiados intentos fallidos. Vuelve a intentarlo en unos minutos.',
      429,
      'ACCOUNT_LOCKED'
    );
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    const attempts = user.failedLoginAttempts + 1;
    const lockingOut = attempts >= MAX_FAILED_LOGIN_ATTEMPTS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: lockingOut ? 0 : attempts,
        lockedUntil: lockingOut ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
      },
    });
    throw new AppError('Correo o contraseña incorrectos.', 401, 'INVALID_CREDENTIALS');
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  }

  // Si el usuario activó 2FA (Mi Cuenta, sección Seguridad), el login
  // no entrega sesión todavía: entrega un token corto (5 min) que solo
  // sirve para completar el segundo paso en /auth/verify-2fa.
  if (user.twoFactorEnabled) {
    const pendingToken = jwt.sign({ userId: user.id, type: 'PENDING_2FA' }, config.jwtSecret, {
      expiresIn: PENDING_2FA_EXPIRES_IN,
    });
    return { requiresTwoFactor: true, pendingToken };
  }

  const session = await createSession(user.id, { deviceInfo, ipAddress });
  return buildSession(user, session.id);
}

// Segundo paso del login cuando el usuario tiene 2FA activo: valida el
// código de la app autenticadora contra el secreto cifrado y, si es
// correcto, recién ahí crea la sesión y entrega el token normal.
async function completeTwoFactorLogin(pendingToken, code, { deviceInfo, ipAddress } = {}) {
  let payload;
  try {
    payload = jwt.verify(pendingToken, config.jwtSecret);
  } catch {
    throw new AppError('El código de verificación venció. Vuelve a iniciar sesión.', 401, 'PENDING_LOGIN_EXPIRED');
  }
  if (payload.type !== 'PENDING_2FA') {
    throw new AppError('Token inválido.', 400, 'INVALID_PENDING_TOKEN');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.isActive || !user.twoFactorEnabled || !user.twoFactorSecretEncrypted) {
    throw new AppError('No se pudo completar el inicio de sesión.', 400, 'TWO_FACTOR_NOT_AVAILABLE');
  }

  // require perezoso: otplib arrastra una dependencia ESM (@scure/base)
  // que Jest no puede parsear si se carga al importar este archivo —
  // cargarlo solo cuando de verdad se necesita evita que CUALQUIER test
  // que solo toque login()/acceptInvitation() se rompa por esto.
  const otplib = require('otplib');
  const secret = decrypt(user.twoFactorSecretEncrypted);
  const { valid } = await otplib.verify({ token: code, secret });
  if (!valid) {
    throw new AppError('El código no es correcto. Revisa la hora de tu teléfono e inténtalo de nuevo.', 401, 'INVALID_2FA_CODE');
  }

  const session = await createSession(user.id, { deviceInfo, ipAddress });
  return buildSession(user, session.id);
}

// Acepta una invitación del módulo Niveles de Acceso: el usuario todavía
// no tiene sesión (por eso vive en core/auth, no en access-levels, que
// exige estar autenticado) — busca por el token de un solo uso, pone la
// contraseña que eligió y lo deja ACTIVE, devolviendo una sesión igual
// que login().
async function acceptInvitation(token, password, { deviceInfo, ipAddress } = {}) {
  const user = await prisma.user.findUnique({ where: { invitationToken: token } });
  if (!user || user.status !== 'INVITED') {
    throw new AppError('El enlace de invitación no es válido.', 400, 'INVALID_INVITATION');
  }
  if (user.invitationExpiresAt && user.invitationExpiresAt < new Date()) {
    throw new AppError('El enlace de invitación venció. Pide que te inviten de nuevo.', 400, 'INVITATION_EXPIRED');
  }

  // El cupo del rol se validó al invitar, pero puede haber cambiado
  // desde entonces (otras invitaciones aceptadas, alguien activado a
  // mano) — se revisa de nuevo justo antes de activar, mismo criterio
  // que ya usa activateUser en access-levels para el mismo problema.
  const activeCount = await prisma.user.count({
    where: { companyId: user.companyId, role: user.role, status: 'ACTIVE' },
  });
  assertQuotaAvailable(user.role, activeCount);

  const passwordHash = await bcrypt.hash(password, 10);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      status: 'ACTIVE',
      isActive: true,
      invitationToken: null,
      invitationExpiresAt: null,
    },
  });

  await auditService.log({
    companyId: updated.companyId,
    userId: updated.id,
    action: 'user.invitation_accepted',
    entityType: 'User',
    entityId: updated.id,
    oldValue: { status: 'INVITED' },
    newValue: { status: 'ACTIVE' },
  });

  const session = await createSession(updated.id, { deviceInfo, ipAddress });
  return buildSession(updated, session.id);
}

module.exports = { login, completeTwoFactorLogin, acceptInvitation, buildSession, createSession };
