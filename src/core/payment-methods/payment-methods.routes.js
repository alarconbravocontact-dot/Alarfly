// Sin gate de módulo a propósito, mismo criterio que /glossary y
// /notifications: los métodos de pago son una utilidad transversal que
// cualquier usuario autenticado necesita consultar (ej. para registrar
// un cobro), sin importar a qué módulos de negocio tiene acceso.
const { Router } = require('express');
const validate = require('../middlewares/validate');
const { requireAuth, requireRole } = require('../auth/auth.middleware');
const { createPaymentMethodSchema, updatePaymentMethodSchema, listPaymentMethodsQuerySchema } = require('./payment-methods.validator');
const controller = require('./payment-methods.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.use(requireAuth);
router.get('/', validate(listPaymentMethodsQuerySchema, 'query'), controller.list);
router.post('/', canManage, validate(createPaymentMethodSchema), controller.create);
router.patch('/:id', canManage, validate(updatePaymentMethodSchema), controller.update);

module.exports = router;
