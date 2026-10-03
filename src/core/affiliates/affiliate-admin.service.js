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
// Auditoría Post-Afiliados (hallazgo IMPORTANTE, corregido acá): la
// versión original leía la comisión, validaba la transición, y RECIÉN
// DESPUÉS escribía — dos peticiones concurrentes (ej. dos pestañas del
// mismo Administrador, o dos Administradores de plataforma) podían leer
// el mismo estado PENDING, las dos pasar `assertCanTransitionCommission`,
// y las dos escribir sin enterarse una de la otra (la segunda pisa
// silenciosamente el resultado de la primera, con dos entradas de
// auditoría contradictorias). No es un escenario de alta probabilidad
// hoy (normalmente un solo Administrador de plataforma), pero es dinero
// real (comisiones) y la corrección es simple y segura: el `update` se
// vuelve CONDICIONAL en el estado que se leyó (`updateMany` con
// `status` en el `where`, atómico a nivel de base de datos) — si otra
// petición ya cambió el estado entre medio, no actualiza ninguna fila y
// se rechaza con un mensaje claro en vez de corromper el historial.
async function transitionCommissionStatus(commissionId, toStatus, adminUserId, note) {
  const commission = await prisma.affiliateCommission.findUnique({ where: { id: commissionId } });
  if (!commission) {
    throw new AppError('No se encontró esa comisión.', 404, 'COMMISSION_NOT_FOUND');
  }
  assertCanTransitionCommission(commission.status, toStatus);

  const timestamps = {};
  if (toStatus === 'APPROVED') timestamps.approvedAt = new Date();
  if (toStatus === 'PAID') timestamps.paidAt = new Date();

  // Auditoría Post-Afiliados (hallazgo IMPORTANTE, corregido acá): el
  // cambio de estado y su entrada de auditoría se escribían como dos
  // operaciones separadas — si el proceso caía justo entre medio
  // (crash, caída de conexión a la base), la comisión quedaba cambiada
  // SIN que quedara ningún rastro de quién lo hizo ni cuándo, violando
  // la trazabilidad completa que esta pieza promete explícitamente. El
  // resto del proyecto nunca hace esto (ej. `auth.service.signup` ya
  // pasa `tx` a `auditService.log` dentro de su propio `$transaction`);
  // se iguala acá al mismo criterio.
  return prisma.$transaction(async (tx) => {
    const result = await tx.affiliateCommission.updateMany({
      where: { id: commissionId, status: commission.status },
      data: { status: toStatus, statusNote: note || null, ...timestamps },
    });
    if (result.count === 0) {
      throw new AppError(
        'Esta comisión ya cambió de estado — alguien más la actualizó justo antes. Recarga e inténtalo de nuevo.',
        409,
        'COMMISSION_STATE_CHANGED'
      );
    }

    await auditService.log(
      {
        companyId: null,
        userId: adminUserId,
        action: 'affiliate_commission.status_changed',
        entityType: 'AffiliateCommission',
        entityId: commissionId,
        oldValue: { status: commission.status },
        newValue: { status: toStatus, note: note || null },
      },
      tx
    );

    return tx.affiliateCommission.findUnique({ where: { id: commissionId } });
  });
}

async function setAffiliateStatus(affiliateId, status, adminUserId) {
  const affiliate = await prisma.affiliate.findUnique({ where: { id: affiliateId } });
  if (!affiliate) {
    throw new AppError('No se encontró ese afiliado.', 404, 'AFFILIATE_NOT_FOUND');
  }
  // Mismo criterio de concurrencia Y de atomicidad con la auditoría que
  // transitionCommissionStatus (ver su comentario arriba).
  return prisma.$transaction(async (tx) => {
    const result = await tx.affiliate.updateMany({ where: { id: affiliateId, status: affiliate.status }, data: { status } });
    if (result.count === 0) {
      throw new AppError(
        'Este afiliado ya cambió de estado — alguien más lo actualizó justo antes. Recarga e inténtalo de nuevo.',
        409,
        'AFFILIATE_STATE_CHANGED'
      );
    }

    await auditService.log(
      {
        companyId: null,
        userId: adminUserId,
        action: 'affiliate.status_changed',
        entityType: 'Affiliate',
        entityId: affiliateId,
        oldValue: { status: affiliate.status },
        newValue: { status },
      },
      tx
    );

    return tx.affiliate.findUnique({ where: { id: affiliateId } });
  });
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
