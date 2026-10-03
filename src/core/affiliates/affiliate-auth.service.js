const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../database/prisma');
const config = require('../config');
const AppError = require('../utils/AppError');
const auditService = require('../audit/audit.service');
const { assertStrongPassword } = require('../account/services/security.rules');
const { buildCodeFromBytes } = require('./affiliates.rules');

// Autenticación propia del afiliado — separada de core/auth a
// propósito: un afiliado NO es un User (no pertenece a ninguna
// Company, ver encabezado de los modelos en schema.prisma), así que
// `requireAuth`/el JWT de sesión normal no le aplican. Mismo mecanismo
// de siempre (bcrypt + JWT firmado con el mismo JWT_SECRET), pero con
// un payload de forma distinta (`type: 'affiliate'`, `affiliateId`,
// nunca `userId`/`companyId`) para que jamás pueda confundirse con un
// token de sesión de Company ni viceversa — `requireAuth` ignora
// cualquier payload sin `companyId`, y `requireAffiliateAuth` (ver
// affiliate-auth.middleware.js) exige `type === 'affiliate'`.
//
// Simplificación consciente: a diferencia de User (que desde Mi Cuenta
// tiene `UserSession` revocable de verdad), el afiliado no tiene tabla
// de sesión — su JWT simplemente expira solo. El afiliado nunca mueve
// dinero ni aprueba nada desde su propia sesión (solo lee su propio
// tablero), así que la paridad completa de sesión revocable no se
// justificó para esta pieza — documentado, no un descuido.
const AFFILIATE_JWT_EXPIRES_IN = '30d';

function buildAffiliateToken(affiliate) {
  const token = jwt.sign({ affiliateId: affiliate.id, type: 'affiliate' }, config.jwtSecret, {
    expiresIn: AFFILIATE_JWT_EXPIRES_IN,
  });
  return {
    token,
    affiliate: { id: affiliate.id, name: affiliate.name, email: affiliate.email, code: affiliate.code, status: affiliate.status },
  };
}

async function generateUniqueCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = buildCodeFromBytes(crypto.randomBytes(6));
    const existing = await prisma.affiliate.findUnique({ where: { code } });
    if (!existing) return code;
  }
  // Prácticamente irrepresentable con el alfabeto de 32 símbolos^6 ≈
  // mil millones de combinaciones, pero nunca se deja un bucle sin
  // salida — si ocurriera, es mejor un error claro que colgar la
  // petición.
  throw new AppError('No se pudo generar un código único. Vuelve a intentarlo.', 500, 'CODE_GENERATION_FAILED');
}

async function registerAffiliate(name, email, password, phone) {
  const passwordProblems = assertStrongPassword(password);
  if (passwordProblems.length > 0) {
    throw new AppError(`La contraseña debe tener ${passwordProblems.join(', ')}.`, 400, 'WEAK_PASSWORD');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.affiliate.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new AppError('Ya existe una cuenta de afiliado con ese correo.', 409, 'EMAIL_ALREADY_REGISTERED');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const code = await generateUniqueCode();

  // Vínculo informativo (nunca de autenticación, ver encabezado del
  // modelo): si ya existe un User de Alarfly con este mismo correo, se
  // guarda la referencia para que el panel de administración muestre
  // "también es cliente de Alarfly" — no cambia en nada el flujo.
  const linkedUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  const affiliate = await prisma.affiliate.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash,
      phone: phone || null,
      code,
      linkedUserId: linkedUser ? linkedUser.id : undefined,
    },
  });

  await auditService.log({
    companyId: null,
    userId: null,
    action: 'affiliate.registered',
    entityType: 'Affiliate',
    entityId: affiliate.id,
    newValue: { email: normalizedEmail, code },
  });

  return buildAffiliateToken(affiliate);
}

async function loginAffiliate(email, password) {
  const normalizedEmail = email.trim().toLowerCase();
  const affiliate = await prisma.affiliate.findUnique({ where: { email: normalizedEmail } });
  if (!affiliate) {
    throw new AppError('Correo o contraseña incorrectos.', 401, 'INVALID_CREDENTIALS');
  }
  const matches = await bcrypt.compare(password, affiliate.passwordHash);
  if (!matches) {
    throw new AppError('Correo o contraseña incorrectos.', 401, 'INVALID_CREDENTIALS');
  }
  if (affiliate.status === 'SUSPENDED') {
    throw new AppError('Esta cuenta de afiliado está suspendida.', 403, 'AFFILIATE_SUSPENDED');
  }
  return buildAffiliateToken(affiliate);
}

module.exports = { registerAffiliate, loginAffiliate, generateUniqueCode };
