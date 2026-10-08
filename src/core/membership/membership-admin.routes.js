const { Router } = require('express');
const validate = require('../middlewares/validate');
const { requireAuth } = require('../auth/auth.middleware');
const { requireMembershipAdmin } = require('./membership-admin.middleware');
const { decidePaymentSchema } = require('./membership.validator');
const controller = require('./membership-admin.controller');
const asyncHandler = require('../utils/asyncHandler');
const prisma = require('../database/prisma');

const router = Router();

// Deliberadamente FUERA de la puerta de abajo — mismo criterio ya usado
// por `GET /affiliate-admin/am-i-admin`: el frontend necesita poder
// preguntar "¿puedo ver el enlace de administración de membresías?"
// antes de tener el permiso, para no mostrar un ítem de menú que el
// servidor de todas formas va a rechazar.
router.get(
  '/am-i-admin',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth.userId }, select: { isMembershipAdmin: true } });
    res.json({ isAdmin: !!user?.isMembershipAdmin });
  })
);

router.use(requireAuth, requireMembershipAdmin);

router.get('/payments', controller.listPendingPayments);
router.get('/payments/:id/proof', controller.getPaymentProof);
router.patch('/payments/:id/decide', validate(decidePaymentSchema), controller.decidePayment);

module.exports = router;
