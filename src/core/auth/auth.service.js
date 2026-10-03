const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../database/prisma');
const config = require('../config');
const AppError = require('../utils/AppError');
const auditService = require('../audit/audit.service');
const { assertQuotaAvailable } = require('../rbac/rbac.rules');
const { decrypt } = require('../utils/crypto');
const { assertStrongPassword } = require('../account/services/security.rules');
const affiliatesService = require('../affiliates/affiliates.service');

const PENDING_2FA_EXPIRES_IN = '5m';
const TRIAL_DAYS = 7;

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

// Fase Landing — Registro Público: hasta ahora la ÚNICA forma de
// entrar a Alarfly era que un Administrador ya existente invitara a
// alguien (inviteUser/acceptInvitation, siempre DENTRO de una empresa
// que ya existe). Esta función es la primera puerta real para una
// persona que NUNCA usó Alarfly y no tiene a nadie que la invite:
// crea un User (rol ADMIN, sin cupo que validar — ROLE_QUOTAS no
// limita a ADMIN) Y una Company nueva en una sola transacción, mismo
// patrón `$transaction` que ya usa todo el proyecto para operaciones
// que deben ser atómicas (ej. inventory-movements). Igual que
// acceptInvitation, activa la cuenta de inmediato (ACTIVE, sin paso de
// verificación por correo) porque el proyecto nunca ha tenido
// servidor de correo saliente — mismo límite ya documentado y
// aceptado en el resto de Alarfly, no una omisión nueva de esta pieza.
// NO crea plan de cuentas, periodo contable, ni ningún dato de
// configuración: el checklist de onboarding ya construido
// (setup-status.service.js/SetupProgressBar) ya guía ese camino
// dentro del producto — duplicar eso acá sería reinventar algo que ya
// funciona.
// Fase Afiliados: `referralCode` es el único punto de entrada real de
// la atribución de un referido — viene del `?ref=` que la Landing/el
// formulario de registro capturaron y reenvían tal cual (ver
// frontend/src/pages/SignupPage.jsx). Mejor-esfuerzo a propósito: un
// código inválido/inactivo/autorreferido nunca bloquea el registro,
// solo no genera atribución (ver affiliates.service.attributeReferral).
async function signup(companyName, name, email, password, { deviceInfo, ipAddress, referralCode } = {}) {
  const passwordProblems = assertStrongPassword(password);
  if (passwordProblems.length > 0) {
    throw new AppError(`La contraseña debe tener ${passwordProblems.join(', ')}.`, 400, 'WEAK_PASSWORD');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError('Ya existe una cuenta con ese correo.', 409, 'EMAIL_ALREADY_REGISTERED');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const trialStartedAt = new Date();
  const trialEndsAt = new Date(trialStartedAt.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const user = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { name: companyName, trialStartedAt, trialEndsAt },
    });
    const createdUser = await tx.user.create({
      data: {
        companyId: company.id,
        name,
        email,
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        isActive: true,
      },
    });
    await auditService.log(
      {
        companyId: company.id,
        userId: createdUser.id,
        action: 'company.signed_up',
        entityType: 'Company',
        entityId: company.id,
        newValue: { name: companyName, trialEndsAt },
      },
      tx
    );

    if (referralCode) {
      await affiliatesService.attributeReferral(tx, referralCode.trim().toUpperCase(), company, email);
    }

    return createdUser;
  });

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

module.exports = { login, completeTwoFactorLogin, acceptInvitation, signup, buildSession, createSession };
