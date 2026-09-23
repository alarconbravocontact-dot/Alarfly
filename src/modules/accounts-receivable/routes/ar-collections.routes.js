const { Router } = require('express');
const { requireRole } = require('../../../core/auth/auth.middleware');
const controller = require('../controllers/ar-collections.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.post('/scan', canManage, controller.scan);

module.exports = router;
