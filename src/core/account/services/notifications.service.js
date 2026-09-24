// Mi Cuenta, punto 9: qué tipos de alerta quiere recibir el usuario y
// por qué canal. Reutiliza el AlertType que ya define core/alerts (el
// mismo motor de Tesorería/Fiscal/Inventario/AR) — no se inventa un
// catálogo de tipos de notificación aparte.
const prisma = require('../../database/prisma');

const ALERT_TYPE_LABELS = {
  LOW_BALANCE: 'Saldo bajo en cuenta',
  CREDIT_CARD_NEAR_LIMIT: 'Tarjeta cerca del límite',
  PAYMENT_DUE_SOON: 'Pago próximo a vencer',
  FISCAL_OBLIGATION_DUE: 'Obligación fiscal próxima',
  CUSTOMER_RECURRING_LATE_PAYMENT: 'Cliente con atraso recurrente',
  LOW_STOCK: 'Stock bajo',
  PRODUCT_EXPIRING_SOON: 'Producto por vencer',
  AR_COLLECTION_ESCALATION: 'Cobranza escalonada de AR',
  ADVANCED_ANALYSIS_ALERT: 'Alerta de análisis avanzado',
  BANK_ACCOUNT_DISCONNECTED: 'Cuenta bancaria desconectada',
  APPROVAL_PENDING: 'Aprobación pendiente',
};

// Todo tipo de alerta que el usuario nunca configuró aparece con los
// valores por defecto (en la app: sí, por correo/push: no, porque el
// envío real todavía no existe — ver core/alerts.notifyAlert) en vez
// de fallar o quedar invisible.
async function listNotificationPreferences(companyId, userId) {
  const saved = await prisma.userNotificationPreference.findMany({ where: { userId } });
  const savedByType = Object.fromEntries(saved.map((p) => [p.alertType, p]));

  return Object.entries(ALERT_TYPE_LABELS).map(([alertType, label]) => {
    const existing = savedByType[alertType];
    return {
      alertType,
      label,
      emailEnabled: existing ? existing.emailEnabled : false,
      pushEnabled: existing ? existing.pushEnabled : false,
      inAppEnabled: existing ? existing.inAppEnabled : true,
    };
  });
}

async function updateNotificationPreference(companyId, userId, alertType, { emailEnabled, pushEnabled, inAppEnabled }) {
  return prisma.userNotificationPreference.upsert({
    where: { userId_alertType: { userId, alertType } },
    update: { emailEnabled, pushEnabled, inAppEnabled },
    create: { companyId, userId, alertType, emailEnabled, pushEnabled, inAppEnabled },
  });
}

module.exports = { listNotificationPreferences, updateNotificationPreference, ALERT_TYPE_LABELS };
