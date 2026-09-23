const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const {
  startReconciliationSchema,
  manualMatchSchema,
  matchWithNewEntrySchema,
} = require('../validators/reconciliation.validator');
const controller = require('../controllers/reconciliation.controller');

const router = Router();

const canManage = requireRole('ADMIN');

router.get('/exceptions', controller.exceptions);
router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(startReconciliationSchema), controller.start);
router.post('/:id/auto-match', canManage, controller.runAutoMatch);
router.post('/:id/manual-match', canManage, validate(manualMatchSchema), controller.manualMatch);
router.post('/:id/match-with-new-entry', canManage, validate(matchWithNewEntrySchema), controller.matchWithNewEntry);
router.post('/:id/matches/:matchId/reverse', canManage, controller.reverseMatch);
router.post('/:id/complete', canManage, controller.complete);

module.exports = router;
