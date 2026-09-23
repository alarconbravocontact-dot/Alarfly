const { Router } = require('express');
const { requireRole } = require('../../../core/auth/auth.middleware');
const controller = require('../controllers/accounts.controller');

const router = Router();

router.get('/', controller.listTemplates);
router.post('/:templateId/apply', requireRole('ADMIN', 'ACCOUNTANT'), controller.applyTemplate);

module.exports = router;
