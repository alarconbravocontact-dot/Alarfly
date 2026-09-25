// Lista única de valores del enum `AlertType` de Prisma, para que los
// validadores Zod de cada módulo (Tesorería, Centro de Notificaciones)
// nunca se desincronicen del enum real — la misma desincronización ya
// pasó dos veces en este proyecto (ver CLAUDE.md, "lección repetida").
const ALERT_TYPES = [
  'LOW_BALANCE',
  'CREDIT_CARD_NEAR_LIMIT',
  'PAYMENT_DUE_SOON',
  'FISCAL_OBLIGATION_DUE',
  'CUSTOMER_RECURRING_LATE_PAYMENT',
  'LOW_STOCK',
  'PRODUCT_EXPIRING_SOON',
  'AR_COLLECTION_ESCALATION',
  'ADVANCED_ANALYSIS_ALERT',
  'BANK_ACCOUNT_DISCONNECTED',
  'APPROVAL_PENDING',
  'LIQUIDITY_RISK_FORECAST',
];

module.exports = { ALERT_TYPES };
