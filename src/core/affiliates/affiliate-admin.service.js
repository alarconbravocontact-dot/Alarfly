const prisma = require('../database/prisma');
const AppError = require('../utils/AppError');
const auditService = require('../audit/audit.service');
const { assertCanTransitionCommission } = require('./affiliates.rules');

async function listAffiliates({ status } = {}) {
  const affiliates = await prisma.affiliate.findMany({
    where: { status: status || undefined },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { referrals: true, commissions: true } },
      linkedUser: { select: { id: true, name: true, email: true, companyId: true } },
    },
  });
  return affiliates;
}

async function getAffiliateDetail(affiliateId) {
  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    include: {
      linkedUser: { select: { id: true, name: true, email: true, companyId: true } },
      referrals: {
        orderBy: { attributedAt: 'desc' },
        include: { referredCompany: { select: { id: true, name: true, createdAt: true } }, commissions: true },
      },
    },
  });
  if (!affiliate) {
    throw new AppError('No se encontró ese afiliado.', 404, 'AFFILIATE_NOT_FOUND');
  }
  return affiliate;
}

async function listAllCommissions({ status, affiliateId } = {}) {
  return prisma.affiliateCommission.findMany({
    where: { status: status || undefined, affiliateId: affiliateId || undefined },
    orderBy: { createdAt: 'desc' },
    include: {
      affiliate: { select: { id: true, name: true, email: true, code: true } },
      referral: { include: { referredCompany: { select: { id: true, name: true } } } },
    },
  });
}

// Nunca confía en un monto enviado por el cliente: la comisión ya fue
// calculada y grabada en el momento en que se generó (ver
// affiliates.service.attributeReferral) — esta función SOLO mueve el
// estado, jamás el monto. `adminUserId`/`adminCompanyId` son del
// Administrador de plataforma que hace el cambio (para la auditoría);
// `adminCompanyId` puede no tener sentido real para esta acción (es
// cruzada, no de SU empresa) pero se registra igual porque AuditLog
// todavía exige companyId O userId para poder filtrar por quién hizo
// qué — acá se graba companyId: null (ver encabezado del modelo) y sí
// el userId real del administrador, que es lo que realmente identifica
// quién actuó.
async function transitionCommissionStatus(commissionId, toStatus, adminUserId, note) {
  const commission = await prisma.affiliateCommission.findUnique({ where: { id: commissionId } });
  if (!commission) {
    throw new AppError('No se encontró esa comisión.', 404, 'COMMISSION_NOT_FOUND');
  }
  assertCanTransitionCommission(commission.status, toStatus);

  const timestamps = {};
  if (toStatus === 'APPROVED') timestamps.approvedAt = new Date();
  if (toStatus === 'PAID') timestamps.paidAt = new Date();

  const updated = await prisma.affiliateCommission.update({
    where: { id: commissionId },
    data: { status: toStatus, statusNote: note || null, ...timestamps },
  });

  await auditService.log({
    companyId: null,
    userId: adminUserId,
    action: 'affiliate_commission.status_changed',
    entityType: 'AffiliateCommission',
    entityId: commissionId,
    oldValue: { status: commission.status },
    newValue: { status: toStatus, note: note || null },
  });

  return updated;
}

async function setAffiliateStatus(affiliateId, status, adminUserId) {
  const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
  if (!affiliate) {
    throw new AppError('No se encontró ese afiliado.', 404, 'AFFILIATE_NOT_FOUND');
  }
  const updated = await prisma.affiliate.update({ where: { id: affiliateId }, data: { status } });

  await auditService.log({
    companyId: null,
    userId: adminUserId,
    action: 'affiliate.status_changed',
    entityType: 'Affiliate',
    entityId: affiliateId,
    oldValue: { status: affiliate.status },
    newValue: { status },
  });

  return updated;
}

// Historial cruzado de auditoría del programa (puntos 8/15 del
// prompt): a diferencia de `audit.service.listForCompany` (exige
// companyId), estas acciones son de plataforma — se agrega una función
// mínima nueva en audit.service para esto en vez de reconstruir una
// consulta de auditoría paralela.
async function listAuditTrail() {
  return auditService.listForEntityTypesAnyCompany(['Affiliate', 'AffiliateReferral', 'AffiliateCommission']);
}

module.exports = {
  listAffiliates,
  getAffiliateDetail,
  listAllCommissions,
  transitionCommissionStatus,
  setAffiliateStatus,
  listAuditTrail,
};
