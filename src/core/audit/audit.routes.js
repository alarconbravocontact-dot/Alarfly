const { Router } = require('express');
const { requireAuth, requireRole } = require('../auth/auth.middleware');
const controller = require('./audit.controller');

// Fase 11 (sección 14): antes vivía SOLO bajo `/accounting/audit-log`,
// detrás de `requireModuleAccess('accounting')` — la bitácora de
// auditoría es transversal a los 9 módulos (Tesorería, Fiscal,
// Inventario, AR/AP, RBAC, Mi Cuenta...), así que atarla a un módulo
// en particular era arbitrario (mismo motivo por el que `/notifications`
// y `/fx/latest-rates` ya se movieron a rutas neutrales en fases
// anteriores). Se mueve acá, dueña de `core/audit`, sin gate de
// módulo — pero sigue siendo ADMIN-only, porque ver TODO lo que hizo
// TODA la empresa (no solo lo propio, a diferencia de Mi Cuenta >
// Actividad) es información administrativa sensible.
const router = Router();

router.use(requireAuth, requireRole('ADMIN'));
router.get('/', controller.list);
router.get('/:entityType/:entityId', controller.forEntity);

module.exports = router;
