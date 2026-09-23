const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const { createInvoiceSchema, listInvoicesQuerySchema, salesTrendQuerySchema } = require('../validators/ar-invoices.validator');
const controller = require('../controllers/ar-invoices.controller');
const recurringController = require('../controllers/ar-recurring.controller');
const timelineController = require('../controllers/ar-invoice-timeline.controller');

const router = Router();
const canManage = requireRole('ADMIN', 'COLLABORATOR');

router.get('/', validate(listInvoicesQuerySchema, 'query'), controller.list);
router.get('/sales-trend', validate(salesTrendQuerySchema, 'query'), controller.salesTrend);
router.get('/:id/recurrence-check', recurringController.checkRecurrence);
router.get('/:id/timeline', timelineController.getTimeline);
router.get('/:id', controller.getOne);
router.post('/', canManage, validate(createInvoiceSchema), controller.create);

module.exports = router;
