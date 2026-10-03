const { Router } = require('express');
const validate = require('../middlewares/validate');
const { requireAffiliateAuth } = require('./affiliate-auth.middleware');
const { registerAffiliateSchema, loginAffiliateSchema } = require('./affiliates.validator');
const controller = require('./affiliates.controller');

const router = Router();

// Públicas: cualquier persona puede registrarse como afiliado sin ser
// usuario de ninguna empresa cliente de Alarfly (ver encabezado de los
// modelos en schema.prisma).
router.post('/register', validate(registerAffiliateSchema), controller.register);
router.post('/login', validate(loginAffiliateSchema), controller.login);

// El resto del dashboard del propio afiliado exige su propia sesión
// (requireAffiliateAuth, nunca requireAuth de Company).
router.use(requireAffiliateAuth);
router.get('/me', controller.getProfile);
router.get('/me/link', controller.getLink);
router.get('/me/summary', controller.getSummary);
router.get('/me/referrals', controller.listReferrals);
router.get('/me/commissions', controller.listCommissions);

module.exports = router;
