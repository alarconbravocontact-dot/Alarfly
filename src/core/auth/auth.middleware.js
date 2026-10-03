const jwt = require('jsonwebtoken');
const config = require('../config');
const AppError = require('../utils/AppError');
const prisma = require('../database/prisma');
const asyncHandler = require('../utils/asyncHandler');

// Verifica el token de sesión y deja los datos del usuario disponibles
// en req.auth para el resto de la petición (companyId, userId, role).
// Si el token trae sessionId (Mi Cuenta, punto 7 — sesiones reales),
// además valida que esa sesión siga sin revocar, para que "cerrar
// sesión remota" corte el acceso de verdad y no sea decorativo. Los
// tokens emitidos ANTES de este cambio no traen sessionId — se
// aceptan igual hasta que expiren solos (8h), sin forzar un
// relogin masivo el día del despliegue.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError('Debes iniciar sesión para hacer esto.', 401, 'NOT_AUTHENTICATED');
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new AppError('Tu sesión no es válida o expiró. Inicia sesión de nuevo.', 401, 'INVALID_TOKEN');
  }

  // Auditoría Post-Afiliados (hallazgo CRÍTICO, corregido acá): este
  // middleware nunca validaba la FORMA del payload, solo que la firma
  // fuera válida — cualquier JWT firmado con el mismo JWT_SECRET pasaba,
  // sin importar para qué se emitió. El proyecto ya firmaba otro tipo de
  // token con esa misma llave (`PENDING_2FA`, de 5 minutos, solo para
  // completar el segundo paso del login) y ahora también el token de
  // afiliado (`type: 'affiliate'`, 30 días, obtenible gratis por
  // cualquiera con solo registrarse en /affiliates/register) — ninguno
  // de los dos trae `companyId`/`role`. Confirmado en vivo antes de este
  // fix: un token de afiliado recién registrado, reenviado como Bearer
  // contra `GET /notifications` (una ruta con requireAuth pero sin
  // requireModuleAccess), devolvía alertas de VARIAS empresas distintas
  // mezcladas — porque `companyId: undefined` en un `where` de Prisma
  // elimina ese filtro por completo (comportamiento documentado de
  // Prisma, no un bug de Prisma) en vez de no encontrar nada. Cualquier
  // endpoint que solo tuviera `requireAuth` (sin un segundo gate de
  // rol/módulo) quedaba expuesto a esta fuga entre empresas. Se corrige
  // en la ÚNICA puerta de entrada real: una sesión de empresa genuina
  // SIEMPRE trae `userId` y `companyId`, y NUNCA trae `type` (ese campo
  // solo existe en los otros dos tipos de token) — cualquier payload que
  // no cumpla esto se rechaza acá, antes de que `req.auth` llegue a
  // ningún servicio.
  if (payload.type || !payload.userId || !payload.companyId) {
    throw new AppError('Tu sesión no es válida o expiró. Inicia sesión de nuevo.', 401, 'INVALID_TOKEN');
  }

  if (payload.sessionId) {
    const session = await prisma.userSession.findUnique({ where: { id: payload.sessionId } });
    if (!session || session.revokedAt || session.userId !== payload.userId) {
      throw new AppError('Esta sesión fue cerrada. Inicia sesión de nuevo.', 401, 'SESSION_REVOKED');
    }
    // No se espera esta escritura: es solo informativa ("última vez
    // activa" en la lista de sesiones) y no debe agregarle latencia a
    // cada petición autenticada del sistema.
    prisma.userSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }

  req.auth = { userId: payload.userId, companyId: payload.companyId, role: payload.role, sessionId: payload.sessionId };
  next();
}

// Restringe una ruta a ciertos roles (ej: solo ADMIN puede reabrir un periodo).
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.auth || !allowedRoles.includes(req.auth.role)) {
      throw new AppError('No tienes permiso para hacer esta acción.', 403, 'FORBIDDEN');
    }
    next();
  };
}

module.exports = { requireAuth: asyncHandler(requireAuth), requireRole };
