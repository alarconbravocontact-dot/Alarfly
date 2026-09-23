const asyncHandler = require('../../utils/asyncHandler');
const profileService = require('../services/profile.service');
const companiesService = require('../services/companies.service');
const securityService = require('../services/security.service');
const roleService = require('../services/role.service');
const preferencesService = require('../services/preferences.service');
const notificationsService = require('../services/notifications.service');
const activityService = require('../services/activity.service');
const deletionService = require('../services/deletion.service');
const setupStatusService = require('../services/setup-status.service');

// ---- Perfil (punto 1) ----
const getProfile = asyncHandler(async (req, res) => {
  res.json(await profileService.getProfile(req.auth.userId));
});

const updateProfile = asyncHandler(async (req, res) => {
  res.json(await profileService.updateProfile(req.auth.userId, req.body));
});

const uploadAvatar = asyncHandler(async (req, res) => {
  const { fileName, mimeType, contentBase64 } = req.body;
  res.json(await profileService.uploadAvatar(req.auth.userId, { fileName, mimeType, contentBase64 }));
});

const getAvatarFile = asyncHandler(async (req, res) => {
  res.json(await profileService.getAvatarFile(req.auth.userId));
});

const updateApprovalSignature = asyncHandler(async (req, res) => {
  res.json(await profileService.updateApprovalSignature(req.auth.userId, req.body.signature));
});

const getCompanyProfile = asyncHandler(async (req, res) => {
  res.json(await profileService.getCompanyProfile(req.auth.companyId));
});

const updateCompanyProfile = asyncHandler(async (req, res) => {
  res.json(await profileService.updateCompanyProfile(req.auth.companyId, req.body));
});

// Barra de progreso de configuración inicial (Panel principal).
const getSetupStatus = asyncHandler(async (req, res) => {
  res.json(await setupStatusService.getSetupStatus(req.auth.companyId));
});

// ---- Empresa activa (punto 5) ----
const listMyCompanies = asyncHandler(async (req, res) => {
  res.json(await companiesService.listMyCompanies(req.auth.userId));
});

const switchActiveCompany = asyncHandler(async (req, res) => {
  const result = await companiesService.switchActiveCompany(req.auth.userId, req.auth.sessionId, req.body.companyId);
  res.json(result);
});

// ---- Seguridad (puntos 2, 3, 7) ----
const changePassword = asyncHandler(async (req, res) => {
  await securityService.changePassword(req.auth.userId, req.auth.companyId, req.body.currentPassword, req.body.newPassword);
  res.json({ success: true });
});

const setupTwoFactor = asyncHandler(async (req, res) => {
  res.json(await securityService.setupTwoFactor(req.auth.userId));
});

const verifyTwoFactorSetup = asyncHandler(async (req, res) => {
  res.json(await securityService.verifyTwoFactorSetup(req.auth.userId, req.auth.companyId, req.body.code));
});

const disableTwoFactor = asyncHandler(async (req, res) => {
  res.json(await securityService.disableTwoFactor(req.auth.userId, req.auth.companyId, req.body.password, req.body.code));
});

const listSessions = asyncHandler(async (req, res) => {
  res.json(await securityService.listSessions(req.auth.userId, req.auth.sessionId));
});

const revokeSession = asyncHandler(async (req, res) => {
  res.json(await securityService.revokeSession(req.auth.userId, req.auth.companyId, req.params.id));
});

// ---- Rol y permisos (punto 4) ----
const getMyRole = asyncHandler(async (req, res) => {
  res.json(await roleService.getMyRoleAndPermissions(req.auth.userId, req.auth.role));
});

// ---- Preferencias (punto 6) ----
const getPreferences = asyncHandler(async (req, res) => {
  res.json(await preferencesService.getPreferences(req.auth.userId, req.auth.companyId));
});

const updatePreferences = asyncHandler(async (req, res) => {
  res.json(await preferencesService.updatePreferences(req.auth.userId, req.body));
});

// ---- Notificaciones (punto 9) ----
const listNotificationPreferences = asyncHandler(async (req, res) => {
  res.json(await notificationsService.listNotificationPreferences(req.auth.companyId, req.auth.userId));
});

const updateNotificationPreference = asyncHandler(async (req, res) => {
  const result = await notificationsService.updateNotificationPreference(
    req.auth.companyId,
    req.auth.userId,
    req.params.alertType,
    req.body
  );
  res.json(result);
});

// ---- Actividad (puntos 8, 11) ----
const listMyActivity = asyncHandler(async (req, res) => {
  res.json(await activityService.listMyActivity(req.auth.companyId, req.auth.userId, req.query));
});

const exportMyActivity = asyncHandler(async (req, res) => {
  const { format, ...range } = req.query;
  const { content, mimeType, fileExtension } = await activityService.exportMyActivity(
    req.auth.companyId,
    req.auth.userId,
    format,
    range
  );
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="mi-actividad.${fileExtension}"`);
  res.send(content);
});

// ---- Baja de cuenta (punto 12) ----
const requestDeletion = asyncHandler(async (req, res) => {
  const result = await deletionService.requestDeletion(req.auth.companyId, req.auth.userId, req.body.reason);
  res.status(201).json(result);
});

const listDeletionRequests = asyncHandler(async (req, res) => {
  res.json(await deletionService.listDeletionRequests(req.auth.companyId, req.query));
});

const decideDeletion = asyncHandler(async (req, res) => {
  const result = await deletionService.decideDeletion(req.auth.companyId, req.auth.userId, req.params.id, req.body);
  res.json(result);
});

module.exports = {
  getProfile,
  updateProfile,
  uploadAvatar,
  getAvatarFile,
  updateApprovalSignature,
  getCompanyProfile,
  updateCompanyProfile,
  getSetupStatus,
  listMyCompanies,
  switchActiveCompany,
  changePassword,
  setupTwoFactor,
  verifyTwoFactorSetup,
  disableTwoFactor,
  listSessions,
  revokeSession,
  getMyRole,
  getPreferences,
  updatePreferences,
  listNotificationPreferences,
  updateNotificationPreference,
  listMyActivity,
  exportMyActivity,
  requestDeletion,
  listDeletionRequests,
  decideDeletion,
};
