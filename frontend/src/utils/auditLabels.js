// Rediseño UX/UI (Etapa 5, bloque Auditoría) — bug real corregido: la
// bitácora de auditoría (`AuditTrailPage` y, con el mismo dato, la
// actividad personal de Mi Cuenta en `ActivitySection`) mostraba
// `entityType`/`action` tal como los guarda `core/audit` internamente
// — nombres de modelo de Prisma en PascalCase ("ArInvoice") y códigos
// de evento en snake_case con puntos ("ar_invoice.created") — texto
// técnico crudo, exactamente lo que CLAUDE.md prohíbe mostrarle a un
// usuario sin conocimientos de programación, y lo opuesto de lo que
// pide el documento maestro para Auditoría ("QUÉ/QUIÉN/CUÁNDO/SOBRE
// QUÉ/QUÉ ACCIÓN" debe entenderse de un vistazo).
//
// Nunca se creó un segundo sistema de auditoría: esto es una capa de
// TRADUCCIÓN de solo lectura sobre `AuditLog`, que ya existe. Un
// `entityType`/`action` nuevo que todavía no esté en estos mapas
// nunca se ve roto ni en blanco — `humanizeToken()` genera un texto
// legible igual, así que agregar un módulo nuevo al backend nunca deja
// la bitácora mostrando algo sin traducir (mismo criterio de "mejor
// una traducción genérica que un texto crudo" que ya usa el resto del
// proyecto para evitar el patrón de "enum ampliado, catálogo
// desactualizado" documentado varias veces en PROGRESS_LOG.md).

function humanizeToken(token) {
  if (!token) return '';
  // "ar_invoice" | "exit_created" -> "Ar invoice" | "Exit created"
  const spaced = token.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// entityType (nombre real del modelo Prisma, como lo guarda
// core/audit) -> el mismo sustantivo en español que ya usa el resto
// de la app para esa entidad (breadcrumbs, títulos de pantalla,
// encabezados de tabla) — no se inventó terminología nueva.
const ENTITY_TYPE_LABELS = {
  Account: 'Cuenta contable',
  AccountDeletionRequest: 'Solicitud de baja de cuenta',
  AccountTemplate: 'Plantilla de cuentas',
  AccountingPeriod: 'Periodo contable',
  AccountingSettings: 'Configuración de Contabilidad',
  Alert: 'Alerta',
  AlertRule: 'Regla de alerta',
  AnalysisAutomationConfig: 'Automatización de análisis',
  AnalysisReport: 'Reporte de análisis',
  ApBill: 'Factura de compra',
  ApCreditNote: 'Nota a proveedor',
  ApPayment: 'Pago a proveedor',
  ArApSettings: 'Configuración de CxC/CxP',
  ArCreditNote: 'Nota de crédito',
  ArInvoice: 'Factura de venta',
  ArPayment: 'Cobro',
  ArRecurringInvoiceTemplate: 'Plantilla de factura recurrente',
  BankReconciliation: 'Conciliación bancaria',
  Budget: 'Presupuesto',
  BudgetLine: 'Línea de presupuesto',
  BudgetVarianceJustification: 'Justificación de desviación',
  Company: 'Empresa',
  CreditCardTransaction: 'Movimiento de tarjeta',
  Customer: 'Cliente',
  Debt: 'Deuda',
  DebtInstallment: 'Cuota de deuda',
  DelegatedPermission: 'Permiso delegado',
  ExchangeRate: 'Tasa de cambio',
  FiscalDocumentFile: 'Documento fiscal',
  FiscalElectronicDocument: 'Comprobante electrónico',
  FiscalObligation: 'Obligación fiscal',
  FiscalRiskRule: 'Regla de riesgo fiscal',
  FiscalTransaction: 'Transacción fiscal',
  FixedAsset: 'Activo fijo',
  FpaDimension: 'Dimensión analítica',
  FpaSettings: 'Configuración de FP&A',
  InventoryLot: 'Lote de inventario',
  InventoryMovement: 'Movimiento de inventario',
  InventorySettings: 'Configuración de Inventario',
  InventoryTransfer: 'Transferencia de inventario',
  JournalEntry: 'Asiento contable',
  JournalEntryLineFpaDimension: 'Etiqueta analítica de asiento',
  JuntaMessage: 'Mensaje a la Junta',
  KpiDefinition: 'KPI personalizado',
  PaymentApprovalRule: 'Regla de aprobación de pagos',
  PaymentBatch: 'Lote de pago',
  PaymentMethod: 'Método de pago',
  PaymentOrder: 'Orden de pago',
  PettyCashExpense: 'Gasto de caja chica',
  PettyCashFund: 'Fondo de caja chica',
  PhysicalCount: 'Conteo físico',
  Product: 'Producto',
  ProductCategory: 'Categoría de producto',
  PurchaseOrder: 'Orden de compra',
  ReconciliationMatch: 'Emparejamiento de conciliación',
  SalesDelivery: 'Entrega',
  SalesOrder: 'Pedido de venta',
  StatementImport: 'Importación de extracto',
  StockLevel: 'Nivel de stock',
  TaxJurisdiction: 'Jurisdicción fiscal',
  TaxRate: 'Tasa de impuesto',
  TreasuryAccount: 'Cuenta de tesorería',
  UnitOfMeasure: 'Unidad de medida',
  User: 'Usuario',
  UserSession: 'Sesión de usuario',
  Vendor: 'Proveedor',
  WhatIfScenario: 'Escenario What-If',
};

// El "verbo" es la parte del `action` DESPUÉS del último punto
// ("ar_invoice.created" -> "created") — un conjunto mucho más chico y
// reutilizable entre entidades que el `action` completo.
const ACTION_VERB_LABELS = {
  created: 'creado(a)',
  updated: 'actualizado(a)',
  deleted: 'eliminado(a)',
  requested: 'solicitado(a)',
  confirmed: 'confirmado(a)',
  cancelled: 'cancelado(a)',
  rejected: 'rechazado(a)',
  approved: 'aprobado(a)',
  recorded: 'registrado(a)',
  applied: 'aplicado(a)',
  submitted: 'enviado(a) a aprobación',
  received: 'recibido(a)',
  closed: 'cerrado(a)',
  reopened: 'reabierto(a)',
  reversed: 'revertido(a)',
  blocked: 'bloqueado(a)',
  unblocked: 'desbloqueado(a)',
  disbursed: 'desembolsado(a)',
  drawdown: 'dispuesto(a)',
  repayment: 'con pago registrado',
  installment_paid: 'con cuota pagada',
  depreciated: 'depreciado(a)',
  disposed: 'dado(a) de baja',
  granted: 'otorgado(a)',
  revoked: 'revocado(a)',
  uploaded: 'subido(a)',
  matched_petty_cash: 'cruzado(a) con caja chica',
  flagged: 'marcado(a)',
  processed: 'procesado(a)',
  exported: 'exportado(a)',
  order_added: 'con orden agregada',
  order_removed: 'con orden quitada',
  level_approved: 'con un nivel aprobado',
  fully_approved: 'aprobado(a) por completo',
  entry_generated: 'con asiento generado',
  auto_matched: 'emparejado(a) automáticamente',
  manual_matched: 'emparejado(a) manualmente',
  match_reversed: 'con emparejamiento revertido',
  started: 'iniciado(a)',
  completed: 'completado(a)',
  justified: 'justificado(a)',
  deactivated: 'desactivado(a)',
  activated: 'activado(a)',
  invited: 'invitado(a)',
  invitation_accepted: 'con invitación aceptada',
  password_changed: 'con contraseña cambiada',
  role_changed: 'con rol cambiado',
  session_revoked: 'con sesión cerrada de forma remota',
  two_factor_disabled: 'con verificación en dos pasos desactivada',
  two_factor_enabled: 'con verificación en dos pasos activada',
  variant_added: 'con variante agregada',
  replenished: 'repuesto(a)',
  marked_as_read: 'marcado(a) como leído',
  saved: 'guardado(a)',
  parent_company_changed: 'con empresa matriz cambiada',
  tagged_line: 'con línea etiquetada',
  untagged_line: 'con etiqueta quitada de una línea',
  auto_generated: 'generado(a) automáticamente',
  auto_run: 'corrido(a) automáticamente',
  manual_run: 'corrido(a) manualmente',
  automation_config_updated: 'con la automatización actualizada',
  entry_created: 'con entrada registrada',
  exit_created: 'con salida registrada',
  adjustment_created: 'con ajuste registrado',
  bom_exit_created: 'con salida de kit registrada',
  bom_component_consumed: 'con componente de kit consumido',
  advance_applied: 'con anticipo aplicado',
};

// Traduce un `action` completo ("ar_invoice.created") a una frase
// legible ("Creado(a)") usando solo la parte después del último punto
// — el resto (a qué entidad) ya lo da `entityTypeLabel`. Si el verbo
// no está en el mapa, se humaniza igual (nunca texto crudo con
// guiones bajos ni puntos).
export function formatAuditVerb(action) {
  if (!action) return '';
  const verb = action.includes('.') ? action.slice(action.lastIndexOf('.') + 1) : action;
  return ACTION_VERB_LABELS[verb] || humanizeToken(verb).toLowerCase();
}

// Traduce el `entityType` ("ArInvoice") a su sustantivo en español
// ("Factura de venta"). Si no está en el mapa (entidad nueva que
// todavía no se agregó acá), separa el PascalCase en palabras en vez
// de mostrarlo pegado y en inglés técnico.
export function formatAuditEntityType(entityType) {
  if (!entityType) return '';
  if (ENTITY_TYPE_LABELS[entityType]) return ENTITY_TYPE_LABELS[entityType];
  const spaced = entityType.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  return spaced;
}

// Frase completa para la columna "Acción" de la bitácora, ej.
// "Factura de venta — creado(a)".
export function formatAuditAction(entityType, action) {
  const entityLabel = formatAuditEntityType(entityType);
  const verbLabel = formatAuditVerb(action);
  return entityLabel ? `${entityLabel} — ${verbLabel}` : verbLabel;
}

// El identificador real (CUID) sigue disponible completo vía `title`
// para quien necesite citarlo en un ticket de soporte, pero no
// domina visualmente la celda — un ID técnico completo no ayuda a
// entender "sobre qué" ocurrió la acción, mismo criterio ya usado en
// el resto del proyecto para no mostrar IDs crudos como dato
// principal.
export function shortEntityId(entityId) {
  if (!entityId) return '';
  return entityId.length > 10 ? `…${entityId.slice(-8)}` : entityId;
}
