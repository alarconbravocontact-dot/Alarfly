const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createPeriodSchema, reopenPeriodSchema } = require('../validators/periods.validator');
const controller = require('../controllers/periods.controller');

const router = Router();

router.get('/', controller.list);
router.post('/', requireRole('ADMIN', 'ACCOUNTANT'), validate(createPeriodSchema), controller.create);
router.post('/:id/close', requireRole('ADMIN', 'ACCOUNTANT'), controller.close);
// Reabrir un periodo cerrado es sensible: solo ADMIN, y con motivo obligatorio.
router.post('/:id/reopen', requireRole('ADMIN'), validate(reopenPeriodSchema), controller.reopen);

module.exports = router;
