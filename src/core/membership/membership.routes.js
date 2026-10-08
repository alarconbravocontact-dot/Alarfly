const { Router } = require('express');
const validate = require('../middlewares/validate');
const { requireAuth, requireRole } = require('../auth/auth.middleware');
const { submitPaymentSchema } = require('./membership.validator');
const controller = require('./membership.controller');

const router = Router();

router.use(requireAuth);

// Consultar el plan/la membresía propia es de solo lectura — cualquier
// rol autenticado de la empresa puede verlo (igual criterio que
// `GET /access-levels/my-permissions`: nunca tiene sentido esconder a
// alguien el estado de la suscripción de su propia empresa).
router.get('/plans', controller.listPlans);
router.get('/me', controller.getMyMembership);
router.get('/payments', controller.listMyPayments);

// Enviar un comprobante de pago es una acción sensible (afecta la
// facturación de la empresa) — solo ADMIN, mismo criterio que el resto
// del proyecto para acciones de ese alcance.
router.post('/payments', requireRole('ADMIN'), validate(submitPaymentSchema), controller.submitPayment);

module.exports = router;
