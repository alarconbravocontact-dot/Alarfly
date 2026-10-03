const { Router } = require('express');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../auth/auth.middleware');
const { requireAffiliateProgramAdmin } = require('./affiliate-admin.middleware');
const { setAffiliateStatusSchema, transitionCommissionSchema, updateSettingsSchema } = require('./affiliates.validator');
const controller = require('./affiliate-admin.controller');
const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../database/prisma');

const router = Router();

// Deliberadamente FUERA de la puerta de abajo (mismo criterio ya usado
// por `GET /access-levels/my-permissions`): el frontend necesita poder
// preguntar "¿puedo ver el enlace de administración de afiliados?"
// antes de tener el permiso, para no mostrar un ítem de menú que el
// servidor de todas formas va a rechazar.
router.get(
  '/am-i-admin',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth.userId }, select: { isAffiliateProgramAdmin: true } });
    res.json({ isAdmin: !!user?.isAffiliateProgramAdmin });
  })
);

// Administración CRUZADA del programa — reutiliza la sesión normal de
// Company (requireAuth) y agrega la puerta de plataforma encima
// (requireAffiliateProgramAdmin). Nunca requireAffiliateAuth: un
// afiliado nunca administra el programa, solo lo usa.
router.use(requireAuth, requireAffiliateProgramAdmin);

router.get('/affiliates', controller.listAffiliates);
router.get('/affiliates/:id', controller.getAffiliate);
router.patch('/affiliates/:id/status', validate(setAffiliateStatusSchema), controller.setAffiliateStatus);

router.get('/commissions', controller.listCommissions);
router.patch('/commissions/:id/status', validate(transitionCommissionSchema), controller.transitionCommission);

router.get('/settings', controller.getSettings);
router.patch('/settings', validate(updateSettingsSchema), controller.updateSettings);

router.get('/audit-trail', controller.listAuditTrail);

module.exports = router;
