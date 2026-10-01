// F17-E8: copia fiel de `core/rbac/module-access.js` (backend) — única
// razón de existir: decidir qué enlaces del menú lateral mostrar según
// el rol real, para no invitar a un Colaborador/Contador/Financiero a
// hacer clic en un módulo que el servidor de todas formas le va a
// negar. El bloqueo real sigue siendo 100% del backend
// (`requireModuleAccess`); esto es solo presentación, mismo criterio
// ya usado en `DashboardPage.ACCOUNTING_ROLES`/`SALES_ROLES` y
// `QUICK_ACTIONS[].roles`.
export const MODULE_ROLES = {
  accounting: ['ADMIN', 'ACCOUNTANT', 'FINANCE'],
  treasury: ['ADMIN', 'COLLABORATOR'],
  'accounts-receivable': ['ADMIN', 'COLLABORATOR'],
  'accounts-payable': ['ADMIN', 'COLLABORATOR'],
  inventory: ['ADMIN', 'COLLABORATOR'],
  sales: ['ADMIN', 'COLLABORATOR'],
  fiscal: ['ADMIN', 'ACCOUNTANT'],
  fpa: ['ADMIN', 'FINANCE'],
  reports: ['ADMIN', 'FINANCE'],
  'business-metrics': ['ADMIN', 'FINANCE'],
  'advanced-analytics': ['ADMIN', 'ACCOUNTANT', 'FINANCE'],
  finance: ['ADMIN', 'COLLABORATOR', 'ACCOUNTANT', 'FINANCE'],
};

// 'dashboard' (Inicio) y 'account' (Mi Cuenta) nunca están en
// `MODULE_ROLES` porque el backend no los gatea por módulo — cualquier
// rol autenticado entra. Mismo criterio que `rolesForModule` del
// backend, pero sin el fallback a solo ADMIN (acá el fallback es "no
// hay restricción conocida, se muestra").
export function canAccessModule(role, moduleKey) {
  if (!MODULE_ROLES[moduleKey]) return true;
  return role === 'ADMIN' || MODULE_ROLES[moduleKey].includes(role);
}
