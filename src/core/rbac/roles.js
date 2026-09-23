// Los 4 roles fijos del sistema (Niveles de Acceso). Ver
// docs/ARQUITECTURA_MAESTRA.md y CLAUDE.md para la definición de qué
// puede hacer cada uno — este archivo es la única fuente de verdad en
// código de esos nombres, para que ningún módulo escriba el string a mano.
const ROLES = ['ADMIN', 'ACCOUNTANT', 'FINANCE', 'COLLABORATOR'];

const ROLE_LABELS = {
  ADMIN: 'Administrador',
  ACCOUNTANT: 'Contador',
  FINANCE: 'Financiero',
  COLLABORATOR: 'Colaborador',
};

// Cupo máximo de usuarios ACTIVOS por rol, fijo a nivel de sistema (no
// es algo que el Administrador edite desde la pantalla — por eso vive
// en código, no en una tabla). `null` = sin límite.
const ROLE_QUOTAS = {
  ADMIN: null,
  ACCOUNTANT: 3,
  FINANCE: 4,
  COLLABORATOR: 8,
};

// Único permiso delegable que existe hoy: acceso al módulo Niveles de
// Acceso para un usuario con rol ACCOUNTANT. `permissionKey` es texto
// libre en la base de datos a propósito (ver DelegatedPermission en el
// schema) para poder agregar otro permiso delegado más adelante sin
// migración — esta constante es solo la que el código usa hoy.
const DELEGATABLE_PERMISSIONS = {
  ACCESS_LEVELS: 'ACCESS_LEVELS',
};

module.exports = { ROLES, ROLE_LABELS, ROLE_QUOTAS, DELEGATABLE_PERMISSIONS };
