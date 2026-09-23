// Mi Cuenta, sección Seguridad (puntos 2, 3 y 7 del pedido): cambio de
// contraseña, 2FA (TOTP tipo Google Authenticator) y sesiones activas.
const bcrypt = require('bcryptjs');
const prisma = require('../../database/prisma');
const AppError = require('../../utils/AppError');
const auditService = require('../../audit/audit.service');
const { encrypt, decrypt } = require('../../utils/crypto');

// ---- Punto 2: cambio de contraseña ----
// La fortaleza de la contraseña nueva se valida en el validador Zod
// (security.validator.js) antes de llegar acá — este servicio solo se
// encarga de confirmar la contraseña actual y guardar la nueva.
async function changePassword(userId, companyId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('El usuario indicado no existe.', 404, 'USER_NOT_FOUND');

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    throw new AppError('La contraseña actual no es correcta.', 400, 'CURRENT_PASSWORD_INCORRECT');
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  await auditService.log({
    companyId,
    userId,
    action: 'user.password_changed',
    entityType: 'User',
    entityId: userId,
    oldValue: null,
    newValue: null, // nunca se guarda ni el hash viejo ni el nuevo en el log
  });
}

// ---- Punto 3: 2FA (TOTP) ----
// Genera el secreto y lo guarda cifrado de una vez (con 2FA todavía
// DESACTIVADO) — evita una tabla de "secretos pendientes" aparte: si
// el usuario nunca confirma el código, el secreto queda ahí sin efecto
// hasta que se vuelva a llamar setup (lo pisa) o se confirme.
async function setupTwoFactor(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('El usuario indicado no existe.', 404, 'USER_NOT_FOUND');
  if (user.twoFactorEnabled) {
    throw new AppError('Ya tienes la verificación en dos pasos activada.', 400, 'TWO_FACTOR_ALREADY_ENABLED');
  }


  const otplib = require('otplib');

  const QRCode = require('qrcode');

  const secret = await otplib.generateSecret();
  const uri = await otplib.generateURI({ issuer: 'Alarfly', label: user.email, secret });
  const qrDataUrl = await QRCode.toDataURL(uri);

  await prisma.user.update({ where: { id: userId }, data: { twoFactorSecretEncrypted: encrypt(secret) } });

  return { qrDataUrl, secret };
}

async function verifyTwoFactorSetup(userId, companyId, code) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.twoFactorSecretEncrypted) {
    throw new AppError('Primero genera el código QR de configuración.', 400, 'TWO_FACTOR_SETUP_NOT_STARTED');
  }


  const otplib = require('otplib');
  const secret = decrypt(user.twoFactorSecretEncrypted);
  const { valid } = await otplib.verify({ token: code, secret });
  if (!valid) {
    throw new AppError('El código no es correcto. Revisa la hora de tu teléfono e inténtalo de nuevo.', 401, 'INVALID_2FA_CODE');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: true, twoFactorEnabledAt: new Date() },
  });

  await auditService.log({
    companyId,
    userId,
    action: 'user.two_factor_enabled',
    entityType: 'User',
    entityId: userId,
    oldValue: { twoFactorEnabled: false },
    newValue: { twoFactorEnabled: true },
  });

  return { enabled: true };
}

// Exige contraseña actual + un código válido para desactivar — ambos
// factores, para que no baste con tener la sesión abierta en el
// navegador para bajar la protección.
async function disableTwoFactor(userId, companyId, password, code) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.twoFactorEnabled) {
    throw new AppError('No tienes la verificación en dos pasos activada.', 400, 'TWO_FACTOR_NOT_ENABLED');
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError('La contraseña no es correcta.', 400, 'CURRENT_PASSWORD_INCORRECT');
  }


  const otplib = require('otplib');
  const secret = decrypt(user.twoFactorSecretEncrypted);
  const { valid } = await otplib.verify({ token: code, secret });
  if (!valid) {
    throw new AppError('El código no es correcto.', 401, 'INVALID_2FA_CODE');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecretEncrypted: null, twoFactorEnabledAt: null },
  });

  await auditService.log({
    companyId,
    userId,
    action: 'user.two_factor_disabled',
    entityType: 'User',
    entityId: userId,
    oldValue: { twoFactorEnabled: true },
    newValue: { twoFactorEnabled: false },
  });

  return { enabled: false };
}

// ---- Punto 7: sesiones activas ----
async function listSessions(userId, currentSessionId) {
  const sessions = await prisma.userSession.findMany({
    where: { userId, revokedAt: null },
    orderBy: { lastSeenAt: 'desc' },
  });
  return sessions.map((s) => ({ ...s, isCurrent: s.id === currentSessionId }));
}

async function revokeSession(userId, companyId, sessionId) {
  const session = await prisma.userSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) {
    throw new AppError('La sesión indicada no existe.', 404, 'SESSION_NOT_FOUND');
  }
  if (session.revokedAt) {
    return session; // ya estaba cerrada, no hay nada que hacer
  }

  const updated = await prisma.userSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });

  await auditService.log({
    companyId,
    userId,
    action: 'user.session_revoked',
    entityType: 'UserSession',
    entityId: sessionId,
    oldValue: { revokedAt: null },
    newValue: { revokedAt: updated.revokedAt },
  });

  return updated;
}

module.exports = {
  changePassword,
  setupTwoFactor,
  verifyTwoFactorSetup,
  disableTwoFactor,
  listSessions,
  revokeSession,
};
