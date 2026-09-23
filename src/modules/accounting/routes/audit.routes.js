const { Router } = require('express');
const { requireRole } = require('../../../core/auth/auth.middleware');
const controller = require('../controllers/audit.controller');

const router = Router();

router.use(requireRole('ADMIN'));
router.get('/', controller.list);
router.get('/:entityType/:entityId', controller.forEntity);

module.exports = router;
