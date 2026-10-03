const prisma = require('../database/prisma');
const auditService = require('../audit/audit.service');
const settingsService = require('./affiliate-settings.service');
const { isSelfReferral, computeCommissionAmount, assertCanTransitionCommission } = require('./affiliates.rules');

// Punto central de atribución — llamado DESDE auth.service.signup,
// dentro de la MISMA transacción que crea la Company/User nuevos
// (mismo patrón $transaction que ya usa todo el proyecto para
// operaciones que deben ser atómicas). Si el código no existe, no está
// activo, o es un autorreferido, NO lanza error — la atribución es
// mejor-esfuerzo y nunca debe bloquear un registro legítimo; solo
// devuelve null y el signup sigue exactamente igual que sin referido.
async function attributeReferral(tx, code, newCompany, newUserEmail) {
  if (!code) return null;

  const affiliate = await tx.affiliate.findUnique({ where: { code } });
  if (!affiliate || affiliate.status !== 'ACTIVE') return null;
  if (isSelfReferral(affiliate.email, newUserEmail)) return null;

  const referral = await tx.affiliateReferral.create({
    data: {
      affiliateId: affiliate.id,
      referredCompanyId: newCompany.id,
      codeUsed: code,
    },
  });

  const settings = await settingsService.getSettings(tx);
  const { baseAmount, rateType, rateValue, amount, currency } = computeCommissionAmount(settings);

  const commission = await tx.affiliateCommission.create({
    data: {
      affiliateId: affiliate.id,
      referralId: referral.id,
      eventType: 'SIGNUP',
      baseAmount,
      rateType,
      rateValue,
      amount,
      currency,
    },
  });

  // Dos entradas de auditoría con el mismo evento, cada una desde el
  // punto de vista de quien la va a consultar: la empresa referida (sí
  // tiene companyId real, vive en SU propia bitácora) y el afiliado
  // (companyId: null — ver encabezado de AuditLog en schema.prisma).
  await auditService.log(
    {
      companyId: newCompany.id,
      userId: null,
      action: 'company.referred_by_affiliate',
      entityType: 'Company',
      entityId: newCompany.id,
      newValue: { affiliateId: affiliate.id, codeUsed: code },
    },
    tx
  );
  await auditService.log(
    {
      companyId: null,
      userId: null,
      action: 'affiliate.referral_attributed',
      entityType: 'AffiliateReferral',
      entityId: referral.id,
      newValue: { referredCompanyId: newCompany.id, commissionId: commission.id, amount: amount.toString() },
    },
    tx
  );

  return { referral, commission };
}

// Devuelve SOLO el código — nunca la URL completa: el backend no tiene
// forma confiable de saber cuál es el origen real del frontend (el
// header `Origin` no siempre llega intacto detrás de un proxy de
// desarrollo, confirmado en vivo durante la verificación de esta
// pieza — el enlace salía apuntando al propio backend). El frontend ya
// conoce su propio origen con certeza (`window.location.origin`), así
// que es quien arma la URL completa (ver AffiliateDashboardPage.jsx).
async function getLink(affiliateId) {
  const affiliate = await prisma.affiliate.findUniqueOrThrow({ where: { id: affiliateId } });
  return { code: affiliate.code };
}

async function getSummary(affiliateId) {
  const [referralsCount, commissions] = await Promise.all([
    prisma.affiliateReferral.count({ where: { affiliateId } }),
    prisma.affiliateCommission.findMany({ where: { affiliateId } }),
  ]);

  const totals = { PENDING: 0, APPROVED: 0, PAYABLE: 0, PAID: 0, CANCELLED: 0 };
  let lifetimeEarned = 0; // suma de todo lo que no esté cancelado — "lo que este afiliado generó", pagado o no
  for (const commission of commissions) {
    const amount = Number(commission.amount);
    totals[commission.status] += amount;
    if (commission.status !== 'CANCELLED') lifetimeEarned += amount;
  }

  return {
    referralsCount,
    conversionsCount: commissions.length, // una "conversión" = un evento de comisión generado (hoy, siempre SIGNUP)
    commissionTotals: totals,
    lifetimeEarned,
    currency: commissions[0]?.currency || 'USD',
  };
}

async function listReferrals(affiliateId) {
  return prisma.affiliateReferral.findMany({
    where: { affiliateId },
    orderBy: { attributedAt: 'desc' },
    include: {
      referredCompany: { select: { id: true, name: true, createdAt: true } },
      commissions: { select: { id: true, status: true, amount: true, currency: true, eventType: true } },
    },
  });
}

async function listCommissions(affiliateId, { status } = {}) {
  return prisma.affiliateCommission.findMany({
    where: { affiliateId, status: status || undefined },
    orderBy: { createdAt: 'desc' },
    include: { referral: { include: { referredCompany: { select: { id: true, name: true } } } } },
  });
}

async function getProfile(affiliateId) {
  const affiliate = await prisma.affiliate.findUniqueOrThrow({
    where: { id: affiliateId },
    select: { id: true, name: true, email: true, phone: true, code: true, status: true, createdAt: true },
  });
  return affiliate;
}

module.exports = {
  attributeReferral,
  getLink,
  getSummary,
  listReferrals,
  listCommissions,
  getProfile,
  // Reexportado para que el controlador de administración no tenga que
  // importar directo affiliates.rules — mantiene un solo punto de
  // entrada de servicio por módulo, mismo criterio que el resto del
  // proyecto.
  assertCanTransitionCommission,
};
