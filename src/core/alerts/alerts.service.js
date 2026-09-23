const prisma = require('../database/prisma');
const AppError = require('../utils/AppError');
const auditService = require('../audit/audit.service');

// Motor de alertas genérico: lo usa Tesorería (saldo bajo, tarjetas,
// pagos por vencer) y Fiscal (obligaciones fiscales por vencer). Cada
// módulo dueño de un tipo de alerta escribe su propia función de
// escaneo (qué condiciones detectar), pero todos comparten esta misma
// tabla y esta misma lógica de "no duplicar una alerta ya activa".

// Punto de extensión: cuando se implemente el envío de notificaciones
// (email/push), se dispara desde acá, sin cambiar el resto del motor.
// eslint-disable-next-line no-unused-vars
function notifyAlert(alert) {
  // No implementado todavía.
}

async function createRule(companyId, userId, data) {
  return prisma.$transaction(async (tx) => {
    const rule = await tx.alertRule.create({ data: { companyId, ...data } });
    await auditService.log(
      { companyId, userId, action: 'alert_rule.created', entityType: 'AlertRule', entityId: rule.id, oldValue: null, newValue: rule },
      tx
    );
    return rule;
  });
}

async function listRules(companyId, { isActive } = {}) {
  return prisma.alertRule.findMany({ where: { companyId, isActive: isActive === undefined ? undefined : isActive } });
}

async function deactivateRule(companyId, id, userId) {
  const rule = await prisma.alertRule.findFirst({ where: { id, companyId } });
  if (!rule) throw new AppError('La regla de alerta indicada no existe.', 404, 'ALERT_RULE_NOT_FOUND');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.alertRule.update({ where: { id }, data: { isActive: false } });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'alert_rule.deactivated',
        entityType: 'AlertRule',
        entityId: id,
        oldValue: { isActive: true },
        newValue: { isActive: false },
      },
      tx
    );
    return updated;
  });
}

// Evita duplicar la misma alerta activa para la misma entidad; si ya
// hay una activa, no crea otra (queda como está hasta que se atienda).
async function createAlertIfNotExists({ companyId, ruleId, type, severity, message, entityType, entityId }) {
  const existing = await prisma.alert.findFirst({ where: { companyId, type, entityType, entityId, status: 'ACTIVE' } });
  if (existing) return null;

  const alert = await prisma.alert.create({ data: { companyId, ruleId, type, severity, message, entityType, entityId } });
  notifyAlert(alert);
  return alert;
}

async function listAlerts(companyId, { status, type } = {}) {
  return prisma.alert.findMany({
    where: { companyId, status: status || undefined, type: type || undefined },
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
  });
}

async function acknowledgeAlert(companyId, id, userId) {
  const alert = await prisma.alert.findFirst({ where: { id, companyId } });
  if (!alert) throw new AppError('La alerta indicada no existe.', 404, 'ALERT_NOT_FOUND');
  if (alert.status === 'ACKNOWLEDGED') throw new AppError('Esta alerta ya fue atendida.', 409, 'ALREADY_ACKNOWLEDGED');

  return prisma.$transaction(async (tx) => {
    const updated = await tx.alert.update({
      where: { id },
      data: { status: 'ACKNOWLEDGED', acknowledgedByUserId: userId, acknowledgedAt: new Date() },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'alert.acknowledged',
        entityType: 'Alert',
        entityId: id,
        oldValue: { status: 'ACTIVE' },
        newValue: { status: 'ACKNOWLEDGED' },
      },
      tx
    );
    return updated;
  });
}

// Centro de Notificaciones (todos los módulos, no solo Tesorería):
// las mismas alertas de siempre, pero respetando que el usuario haya
// apagado "en la aplicación" para un tipo puntual desde Mi Cuenta
// (core/account/notifications.service) — un tipo nunca guardado sigue
// activo por defecto (mismo criterio que esa pantalla).
async function listAlertsForUser(companyId, userId, { status, type } = {}) {
  const [alerts, preferences] = await Promise.all([
    listAlerts(companyId, { status, type }),
    prisma.userNotificationPreference.findMany({ where: { userId }, select: { alertType: true, inAppEnabled: true } }),
  ]);
  const disabledTypes = new Set(preferences.filter((p) => !p.inAppEnabled).map((p) => p.alertType));
  return alerts.filter((alert) => !disabledTypes.has(alert.type));
}

module.exports = {
  notifyAlert,
  createRule,
  listRules,
  deactivateRule,
  createAlertIfNotExists,
  listAlerts,
  listAlertsForUser,
  acknowledgeAlert,
};
