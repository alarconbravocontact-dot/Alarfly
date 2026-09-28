const { Router } = require('express');
const { requireAuth, requireRole } = require('../../../core/auth/auth.middleware');
const { requireAccessManagement } = require('../../../core/rbac/rbac.middleware');
const validate = require('../../../core/middlewares/validate');
const {
  inviteUserSchema,
  changeRoleSchema,
  delegatedPermissionSchema,
  companyAccessSchema,
} = require('../validators/users.validator');
const controller = require('../controllers/users.controller');

const router = Router();

router.use(requireAuth);

// Fuera del gate de requireAccessManagement a propósito: cualquier
// usuario autenticado puede consultar sus propios permisos delegados
// (lo usa el frontend para decidir si muestra el ítem de navegación).
router.get('/my-permissions', controller.myPermissions);

router.use(requireAccessManagement);

router.get('/users', controller.list);
router.post('/users/invite', validate(inviteUserSchema), controller.invite);
router.patch('/users/:id/role', validate(changeRoleSchema), controller.changeRole);
router.post('/users/:id/activate', controller.activate);
router.post('/users/:id/deactivate', controller.deactivate);

router.get('/roles', controller.roleCatalog);
router.get('/quotas', controller.quotaStatus);

router.get('/delegated-permissions', controller.listDelegatedPermissions);
// Otorgar/revocar un permiso delegado es una acción de mayor alcance
// (puede crear más gente con acceso a este mismo módulo) — se reserva
// al Administrador real, no a un Contador que ya entró por delegación.
router.post(
  '/delegated-permissions/:id/grant',
  requireRole('ADMIN'),
  validate(delegatedPermissionSchema),
  controller.grantDelegatedPermission
);
router.post(
  '/delegated-permissions/:id/revoke',
  requireRole('ADMIN'),
  validate(delegatedPermissionSchema),
  controller.revokeDelegatedPermission
);

// F14-E3: otorgar/revocar acceso a otra empresa cruza el límite de una
// sola empresa — mismo criterio que los permisos delegados de arriba,
// se reserva al Administrador real, nunca a un Contador delegado.
router.get('/company-access', requireRole('ADMIN'), controller.listCompanyAccess);
router.post('/company-access/grant', requireRole('ADMIN'), validate(companyAccessSchema), controller.grantCompanyAccess);
router.post('/company-access/revoke', requireRole('ADMIN'), validate(companyAccessSchema), controller.revokeCompanyAccess);

module.exports = router;
