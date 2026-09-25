// A qué pantalla lleva cada tipo de alerta al hacer clic — única
// fuente de verdad, reutilizada por la campana de notificaciones
// (NotificationCenter, topbar) y por la capa "Requiere tu atención"
// del Centro Operativo (Inicio, Fase 9) — ninguno de los dos duplica
// este mapa por su cuenta. Un tipo nuevo que se agregue más adelante
// cae en el enlace genérico ('/') hasta que se le asigne uno propio.
export const ALERT_TYPE_LINKS = {
  LOW_BALANCE: '/tesoreria/cuentas',
  CREDIT_CARD_NEAR_LIMIT: '/tesoreria/tarjetas',
  PAYMENT_DUE_SOON: '/tesoreria/liquidez',
  FISCAL_OBLIGATION_DUE: '/fiscal/calendario',
  CUSTOMER_RECURRING_LATE_PAYMENT: '/cuentas/clientes',
  LOW_STOCK: '/inventario/compras',
  PRODUCT_EXPIRING_SOON: '/inventario/lotes',
  AR_COLLECTION_ESCALATION: '/cuentas/facturas-venta',
  ADVANCED_ANALYSIS_ALERT: '/analisis-avanzados/repositorio',
  BANK_ACCOUNT_DISCONNECTED: '/tesoreria/cuentas',
  APPROVAL_PENDING: '/tesoreria/pagos',
  LIQUIDITY_RISK_FORECAST: '/finanzas/liquidez',
};

export function alertLink(type) {
  return ALERT_TYPE_LINKS[type] || '/';
}
