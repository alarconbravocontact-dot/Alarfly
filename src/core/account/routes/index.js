const { Router } = require('express');
const { requireAuth, requireRole } = require('../../auth/auth.middleware');
const validate = require('../../middlewares/validate');
const v = require('../validators/account.validator');
const controller = require('../controllers/account.controller');

const router = Router();

// Mi Cuenta: cualquier usuario autenticado administra la suya propia —
// a diferencia de los módulos de negocio, no hay gate de rol de
// entrada (requireModuleAccess); las pocas acciones que sí son
// sensibles para toda la empresa (perfil de empresa, decidir una baja
// de cuenta) se restringen puntualmente con requireRole('ADMIN').
router.use(requireAuth);

router.get('/profile', controller.getProfile);
router.patch('/profile', validate(v.updateProfileSchema), controller.updateProfile);
router.post('/profile/avatar', validate(v.uploadAvatarSchema), controller.uploadAvatar);
router.get('/profile/avatar', controller.getAvatarFile);
router.patch('/profile/approval-signature', validate(v.updateApprovalSignatureSchema), controller.updateApprovalSignature);

router.get('/company-profile', controller.getCompanyProfile);
router.patch('/company-profile', requireRole('ADMIN'), validate(v.updateCompanyProfileSchema), controller.updateCompanyProfile);

// Barra de progreso de configuración inicial (Panel principal): de
// solo lectura, cualquier usuario autenticado la puede consultar.
router.get('/setup-status', controller.getSetupStatus);

router.get('/companies', controller.listMyCompanies);
router.post('/companies/switch', validate(v.switchActiveCompanySchema), controller.switchActiveCompany);

router.post('/security/change-password', validate(v.changePasswordSchema), controller.changePassword);
router.post('/security/2fa/setup', controller.setupTwoFactor);
router.post('/security/2fa/verify', validate(v.twoFactorCodeSchema), controller.verifyTwoFactorSetup);
router.post('/security/2fa/disable', validate(v.disableTwoFactorSchema), controller.disableTwoFactor);
router.get('/security/sessions', controller.listSessions);
router.post('/security/sessions/:id/revoke', controller.revokeSession);

router.get('/role', controller.getMyRole);

router.get('/preferences', controller.getPreferences);
router.patch('/preferences', validate(v.updatePreferencesSchema), controller.updatePreferences);

router.get('/notification-preferences', controller.listNotificationPreferences);
router.patch(
  '/notification-preferences/:alertType',
  validate(v.updateNotificationPreferenceSchema),
  controller.updateNotificationPreference
);

router.get('/activity', validate(v.activityQuerySchema, 'query'), controller.listMyActivity);
router.get('/activity/export', validate(v.exportActivityQuerySchema, 'query'), controller.exportMyActivity);

router.post('/deletion-requests', validate(v.requestDeletionSchema), controller.requestDeletion);
router.get('/deletion-requests', requireRole('ADMIN'), controller.listDeletionRequests);
router.post(
  '/deletion-requests/:id/decide',
  requireRole('ADMIN'),
  validate(v.decideDeletionSchema),
  controller.decideDeletion
);

module.exports = router;
