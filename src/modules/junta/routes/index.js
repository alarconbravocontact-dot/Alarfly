const { Router } = require('express');
const { requireAuth, requireRole } = require('../../../core/auth/auth.middleware');
const validate = require('../../../core/middlewares/validate');
const { createMessageSchema } = require('../validators/junta.validator');
const controller = require('../controllers/junta.controller');

const router = Router();

// La Junta la usan los 4 roles por igual: cualquiera manda su reporte,
// solo el Administrador ve todos y los marca como revisados — por eso
// acá solo se exige sesión iniciada, sin gate de módulo (a diferencia
// de los demás módulos, que si restringen por rol de entrada).
router.use(requireAuth);

router.get('/messages', controller.list);
router.get('/messages/unread-count', controller.unreadCount);
router.post('/messages', validate(createMessageSchema), controller.create);
router.get('/messages/:id/file', controller.downloadFile);
router.post('/messages/:id/read', requireRole('ADMIN'), controller.markAsRead);

module.exports = router;
