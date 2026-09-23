// Mi Cuenta, punto 4: vista de solo lectura de qué puede hacer el
// usuario en el sistema — no editable por él mismo, solo lo consulta.
// No se duplica ninguna regla: se arma leyendo directo core/rbac
// (que ya define, en código, qué rol entra a cada módulo) y los
// permisos delegados puntuales que ya tenga otorgados.
const { ROLE_LABELS } = require('../../rbac/roles');
const { MODULE_ROLES } = require('../../rbac/module-access');
const delegatedPermissionsService = require('../../rbac/delegated-permissions.service');

const MODULE_LABELS = {
  accounting: 'Contabilidad',
  treasury: 'Tesorería',
  'accounts-receivable': 'Cuentas por Cobrar',
  'accounts-payable': 'Cuentas por Pagar',
  inventory: 'Inventario',
  fiscal: 'Fiscal',
  fpa: 'FP&A',
  reports: 'Reportes',
  'business-metrics': 'Métricas del Negocio',
};

async function getMyRoleAndPermissions(userId, role) {
  const moduleAccess = Object.entries(MODULE_LABELS).map(([key, label]) => ({
    module: key,
    label,
    hasAccess: role === 'ADMIN' || MODULE_ROLES[key].includes(role),
  }));

  const delegatedPermissions = await delegatedPermissionsService.listActiveForUser(userId);

  return {
    role,
    roleLabel: ROLE_LABELS[role] || role,
    isAdministrator: role === 'ADMIN',
    moduleAccess,
    delegatedPermissions,
  };
}

module.exports = { getMyRoleAndPermissions };
