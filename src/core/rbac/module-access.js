// Mapa de qué rol puede ENTRAR a cada módulo (permiso base, "puede ver
// algo de este módulo"). Dentro de cada módulo, las rutas de escritura
// siguen filtrando más fino con `requireRole(...)` como ya hacía el
// proyecto — este mapa es la primera puerta, no la única.
//
// ADMIN entra a todo siempre, no hace falta listarlo en cada módulo,
// pero se lista explícito de todas formas para que este archivo se lea
// solo (sin tener que recordar la regla implícita).
const MODULE_ROLES = {
  accounting: ['ADMIN', 'ACCOUNTANT', 'FINANCE'],
  treasury: ['ADMIN', 'COLLABORATOR'],
  'accounts-receivable': ['ADMIN', 'COLLABORATOR'],
  'accounts-payable': ['ADMIN', 'COLLABORATOR'],
  inventory: ['ADMIN', 'COLLABORATOR'],
  // Fase 3: mismo nivel que Tesorería/AR/AP/Inventario — el
  // Colaborador es quien de verdad vende y entrega en el día a día.
  sales: ['ADMIN', 'COLLABORATOR'],
  fiscal: ['ADMIN', 'ACCOUNTANT'],
  fpa: ['ADMIN', 'FINANCE'],
  reports: ['ADMIN', 'FINANCE'],
  'business-metrics': ['ADMIN', 'FINANCE'],
  'advanced-analytics': ['ADMIN', 'ACCOUNTANT', 'FINANCE'],
};

function rolesForModule(moduleKey) {
  return MODULE_ROLES[moduleKey] || ['ADMIN'];
}

module.exports = { MODULE_ROLES, rolesForModule };
