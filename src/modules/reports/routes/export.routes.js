const { Router } = require('express');
const validate = require('../../../core/middlewares/validate');
const { requireRole } = require('../../../core/auth/auth.middleware');
const {
  exportQuerySchema,
  createScheduledReportSchema,
  updateScheduledReportSchema,
} = require('../validators/export.validator');
const controller = require('../controllers/export.controller');

const router = Router();

// Exportar/ver un reporte puntual es una acción de solo lectura:
// cualquier rol que ya pasó la puerta del módulo Reportes puede
// hacerlo (ver core/rbac/module-access.js). Programar un envío
// recurrente hacia destinatarios externos es una acción de mayor
// alcance, restringida a ADMIN/FINANCE (punto 8: Permisos y
// Visibilidad por Reporte).
const canManageSchedule = requireRole('ADMIN', 'FINANCE');

router.get('/export/:reportType', validate(exportQuerySchema, 'query'), controller.exportReport);

router.post('/scheduled', canManageSchedule, validate(createScheduledReportSchema), controller.createScheduled);
router.get('/scheduled', controller.listScheduled);
router.patch('/scheduled/:id', canManageSchedule, validate(updateScheduledReportSchema), controller.updateScheduled);
router.delete('/scheduled/:id', canManageSchedule, controller.deleteScheduled);
router.post('/scheduled/:id/run', canManageSchedule, controller.runScheduled);

module.exports = router;
