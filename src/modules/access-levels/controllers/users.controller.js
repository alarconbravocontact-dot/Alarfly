const asyncHandler = require('../../../core/utils/asyncHandler');
const usersService = require('../services/users.service');
const delegatedPermissionsService = require('../../../core/rbac/delegated-permissions.service');
const { ROLES, ROLE_LABELS, ROLE_QUOTAS } = require('../../../core/rbac/roles');

// Los permisos delegados del propio usuario que llama — a propósito
// fuera de requireAccessManagement (ver routes/index.js): el frontend
// lo usa para decidir si le muestra el ítem "Niveles de Acceso" en el
// menú a un Contador, sin que eso mismo exija ya tener el permiso.
const myPermissions = asyncHandler(async (req, res) => {
  const permissions = await delegatedPermissionsService.listActiveForUser(req.auth.userId);
  res.json({ permissions });
});

const list = asyncHandler(async (req, res) => {
  const users = await usersService.listUsers(req.auth.companyId);
  res.json(users);
});

const quotaStatus = asyncHandler(async (req, res) => {
  const status = await usersService.getRoleQuotaStatus(req.auth.companyId);
  res.json(status);
});

const roleCatalog = asyncHandler(async (req, res) => {
  res.json(ROLES.map((role) => ({ role, label: ROLE_LABELS[role], quota: ROLE_QUOTAS[role] })));
});

const invite = asyncHandler(async (req, res) => {
  const result = await usersService.inviteUser(req.auth.companyId, req.auth.userId, req.body);
  res.status(201).json(result);
});

const changeRole = asyncHandler(async (req, res) => {
  const user = await usersService.changeRole(req.auth.companyId, req.auth.userId, req.params.id, req.body.role);
  res.json(user);
});

const activate = asyncHandler(async (req, res) => {
  const user = await usersService.activateUser(req.auth.companyId, req.auth.userId, req.params.id);
  res.json(user);
});

const deactivate = asyncHandler(async (req, res) => {
  const user = await usersService.deactivateUser(req.auth.companyId, req.auth.userId, req.params.id);
  res.json(user);
});

const listDelegatedPermissions = asyncHandler(async (req, res) => {
  const grants = await delegatedPermissionsService.listForCompany(req.auth.companyId);
  res.json(grants);
});

const grantDelegatedPermission = asyncHandler(async (req, res) => {
  const grant = await delegatedPermissionsService.grantPermission(
    req.auth.companyId,
    req.auth.userId,
    req.params.id,
    req.body.permissionKey
  );
  res.status(201).json(grant);
});

const revokeDelegatedPermission = asyncHandler(async (req, res) => {
  const grant = await delegatedPermissionsService.revokePermission(
    req.auth.companyId,
    req.auth.userId,
    req.params.id,
    req.body.permissionKey
  );
  res.json(grant);
});

module.exports = {
  myPermissions,
  list,
  quotaStatus,
  roleCatalog,
  invite,
  changeRole,
  activate,
  deactivate,
  listDelegatedPermissions,
  grantDelegatedPermission,
  revokeDelegatedPermission,
};
