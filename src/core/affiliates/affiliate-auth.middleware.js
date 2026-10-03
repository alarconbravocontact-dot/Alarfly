const jwt = require('jsonwebtoken');
const config = require('../config');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// Espejo de core/auth/auth.middleware.requireAuth, pero para el token
// de afiliado (ver affiliate-auth.service.js) — deja el id disponible
// en req.affiliateAuth en vez de req.auth, para que nunca se confunda
// con una sesión de Company ni un controlador use por error el id
// equivocado.
async function requireAffiliateAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new AppError('Debes iniciar sesión como afiliado para hacer esto.', 401, 'NOT_AUTHENTICATED');
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new AppError('Tu sesión no es válida o expiró. Inicia sesión de nuevo.', 401, 'INVALID_TOKEN');
  }

  if (payload.type !== 'affiliate' || !payload.affiliateId) {
    throw new AppError('Token inválido.', 401, 'INVALID_TOKEN');
  }

  req.affiliateAuth = { affiliateId: payload.affiliateId };
  next();
}

module.exports = { requireAffiliateAuth: asyncHandler(requireAffiliateAuth) };
