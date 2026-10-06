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
  // Fase 5: "Finanzas" es la puerta consolidada de entrada (Resumen,
  // Dinero, Cobros, Pagos, CxC, CxP, Financiamiento, Liquidez) — se
  // abre a los 4 roles a propósito, porque cada pieza que consolida ya
  // tiene su propio gate más fino debajo (treasury/accounting/
  // accounts-receivable/accounts-payable), este es solo el "primer
  // portón" del que habla el comentario de arriba del archivo.
  finance: ['ADMIN', 'COLLABORATOR', 'ACCOUNTANT', 'FINANCE'],
  // Módulo Personal (Control → Personal): mismo criterio que fiscal
  // (un dueño claro, no disperso en los 4 roles) — Financiero ya es
  // quien posee Contabilidad/FP&A/Reportes, así que el costo de
  // personal (que termina siendo un gasto contable más) encaja ahí.
  // Dentro del módulo no hay un segundo gate por acción (ver
  // PERSONAL_MODULE_FINAL.md): el maker-checker real está en que quien
  // aprueba una nómina/gasto no puede ser quien la creó/registró, no en
  // restringir el verbo "aprobar" a un rol distinto.
  personal: ['ADMIN', 'FINANCE'],
};

function rolesForModule(moduleKey) {
  return MODULE_ROLES[moduleKey] || ['ADMIN'];
}

module.exports = { MODULE_ROLES, rolesForModule };
