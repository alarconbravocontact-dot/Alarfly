// Membresía de la propia empresa a Alarfly (plan + pago manual con
// comprobante). Ver encabezado de los modelos en schema.prisma para el
// porqué de cada decisión. El precio/plan/moneda SIEMPRE se resuelven
// en el servidor — nunca se leen del body de la petición.
const { Prisma } = require('@prisma/client');
const prisma = require('../database/prisma');
const AppError = require('../utils/AppError');
const auditService = require('../audit/audit.service');
const rules = require('./membership.rules');

const { Decimal } = Prisma;

// Decisión comercial ya tomada (F16): un solo plan real. `getActivePlan`
// lo busca y, si todavía no existe en esta base de datos (entorno nuevo
// sin volver a correr el seed), lo crea una sola vez — defensivo, no
// depende de que alguien se acuerde de re-sembrar.
async function getActivePlan() {
  let plan = await prisma.plan.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
  if (!plan) {
    plan = await prisma.plan.create({
      data: {
        code: 'STANDARD',
        name: 'Alarfly',
        priceAmount: new Decimal('25'),
        currency: 'USD',
        billingPeriodDays: 30,
        trialDays: 7,
        features: [
          'Contabilidad, Tesorería y Cuentas por Cobrar/Pagar',
          'Inventario y Compras',
          'Reportes y Análisis Avanzados',
          'Usuarios ilimitados para el rol Administrador',
        ],
      },
    });
  }
  return plan;
}

async function listPlans() {
  const plan = await getActivePlan();
  return [plan];
}

// Get-or-create: toda empresa necesita exactamente una Membership, pero
// no se crea en el signup (cambio de backend evitado — no hacía falta)
// sino la primera vez que algo la consulta. Para una empresa SIN fecha
// de prueba (creada antes de este módulo, por invitación/seed, nunca
// por registro público) no se le inventa una prueba retroactiva: queda
// ACTIVE directo (ya viene usando la plataforma) — documentado como
// decisión explícita, no asumida en silencio.
async function getOrCreateMembership(companyId) {
  const existing = await prisma.membership.findUnique({ where: { companyId }, include: { plan: true } });
  if (existing) return existing;

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { trialEndsAt: true } });
  if (!company) {
    throw new AppError('La empresa indicada no existe.', 404, 'COMPANY_NOT_FOUND');
  }
  const plan = await getActivePlan();

  const initialStatus = company.trialEndsAt ? 'TRIALING' : 'ACTIVE';
  const membership = await prisma.membership.create({
    data: {
      companyId,
      planId: plan.id,
      status: initialStatus,
      // null a propósito: una empresa ACTIVE "de nacimiento" (sin
      // prueba) nunca vence sola — solo una cancelación explícita la
      // mueve de ahí. Ver computeEffectiveStatus.
      currentPeriodEnd: null,
    },
    include: { plan: true },
  });
  return membership;
}

// Vista de lectura para la pantalla de Planes/Mi Membresía: membresía +
// plan + estado EFECTIVO (recalculado con la regla pura, y persistido
// si cambió, para que quien lea después vea lo mismo sin tener que
// volver a calcularlo).
async function getMembershipView(companyId) {
  const membership = await getOrCreateMembership(companyId);
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { trialEndsAt: true } });

  const effectiveStatus = rules.computeEffectiveStatus(membership, company.trialEndsAt);
  let current = membership;
  if (effectiveStatus !== membership.status) {
    current = await prisma.membership.update({
      where: { id: membership.id },
      data: { status: effectiveStatus },
      include: { plan: true },
    });
  }

  return {
    id: current.id,
    status: current.status,
    plan: current.plan,
    trialEndsAt: company.trialEndsAt,
    currentPeriodEnd: current.currentPeriodEnd,
    cancelledAt: current.cancelledAt,
    daysLeftInTrial: current.status === 'TRIALING' ? rules.daysUntil(company.trialEndsAt) : null,
    canSubmitPayment: rules.assertCanSubmitPayment(current.status),
  };
}

async function listOwnPayments(companyId) {
  const membership = await getOrCreateMembership(companyId);
  return prisma.membershipPayment.findMany({
    where: { membershipId: membership.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      amount: true,
      currency: true,
      method: true,
      referenceNote: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
      createdAt: true,
      proofFileName: true,
    },
  });
}

// Envía un comprobante de pago. Idempotente por `idempotencyKey`: un
// doble clic/refresh que reenvía la misma clave devuelve el registro
// que ya existe en vez de crear uno nuevo o fallar.
async function submitPayment(companyId, userId, { method, referenceNote, idempotencyKey, proof }) {
  const existingByKey = await prisma.membershipPayment.findUnique({ where: { idempotencyKey } });
  if (existingByKey) {
    return existingByKey;
  }

  const membership = await getOrCreateMembership(companyId);
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { trialEndsAt: true } });
  const effectiveStatus = rules.computeEffectiveStatus(membership, company.trialEndsAt);

  if (!rules.assertCanSubmitPayment(effectiveStatus)) {
    throw new AppError(
      'Tu membresía ya está activa o cancelada — no hace falta enviar otro comprobante.',
      400,
      'MEMBERSHIP_PAYMENT_NOT_APPLICABLE'
    );
  }

  const plan = membership.plan;

  return prisma.$transaction(async (tx) => {
    const payment = await tx.membershipPayment.create({
      data: {
        membershipId: membership.id,
        amount: plan.priceAmount,
        currency: plan.currency,
        method,
        referenceNote: referenceNote || null,
        proofFileName: proof?.fileName || null,
        proofMimeType: proof?.mimeType || null,
        proofSizeBytes: proof?.sizeBytes || null,
        proofContentBase64: proof?.contentBase64 || null,
        idempotencyKey,
        requestedByUserId: userId,
      },
    });

    if (effectiveStatus !== 'PENDING_PAYMENT') {
      await tx.membership.update({ where: { id: membership.id }, data: { status: 'PENDING_PAYMENT' } });
    }

    await auditService.log(
      {
        companyId,
        userId,
        action: 'membership_payment.submitted',
        entityType: 'MembershipPayment',
        entityId: payment.id,
        oldValue: null,
        newValue: { method, amount: plan.priceAmount.toString(), currency: plan.currency },
      },
      tx
    );

    return payment;
  });
}

// ---- Administración de plataforma (cruza empresas) ----

async function listPendingPayments() {
  return prisma.membershipPayment.findMany({
    where: { status: 'PENDING_REVIEW' },
    orderBy: { createdAt: 'asc' },
    include: {
      membership: { include: { plan: true, company: { select: { id: true, name: true } } } },
      requestedByUser: { select: { id: true, name: true, email: true } },
    },
  });
}

async function getPaymentProof(paymentId) {
  const payment = await prisma.membershipPayment.findUnique({
    where: { id: paymentId },
    select: { id: true, proofFileName: true, proofMimeType: true, proofSizeBytes: true, proofContentBase64: true },
  });
  if (!payment || !payment.proofContentBase64) {
    throw new AppError('El comprobante indicado no existe.', 404, 'MEMBERSHIP_PAYMENT_PROOF_NOT_FOUND');
  }
  return payment;
}

async function decidePayment(paymentId, reviewerUserId, { approve, note }) {
  const payment = await prisma.membershipPayment.findUnique({
    where: { id: paymentId },
    include: { membership: { include: { plan: true, company: { select: { trialEndsAt: true } } } } },
  });
  if (!payment) {
    throw new AppError('El pago indicado no existe.', 404, 'MEMBERSHIP_PAYMENT_NOT_FOUND');
  }
  if (payment.status !== 'PENDING_REVIEW') {
    throw new AppError('Este pago ya fue revisado.', 400, 'MEMBERSHIP_PAYMENT_ALREADY_DECIDED');
  }

  return prisma.$transaction(async (tx) => {
    const updatedPayment = await tx.membershipPayment.update({
      where: { id: paymentId },
      data: {
        status: approve ? 'CONFIRMED' : 'REJECTED',
        reviewedByUserId: reviewerUserId,
        reviewedAt: new Date(),
        reviewNote: note || null,
      },
    });

    if (approve) {
      const periodDays = payment.membership.plan.billingPeriodDays;
      const base = payment.membership.currentPeriodEnd && payment.membership.currentPeriodEnd > new Date()
        ? payment.membership.currentPeriodEnd
        : new Date();
      const currentPeriodEnd = new Date(base.getTime() + periodDays * 24 * 60 * 60 * 1000);
      await tx.membership.update({
        where: { id: payment.membershipId },
        data: { status: 'ACTIVE', currentPeriodEnd },
      });
    } else if (payment.membership.status === 'PENDING_PAYMENT') {
      // Solo si el rechazo es lo que de verdad tenía la membresía
      // esperando — un comprobante viejo/duplicado rechazado DESPUÉS
      // de que otro ya la activó (ej. dos comprobantes del mismo pago)
      // nunca debe bajarla de ACTIVE hacia atrás.
      const fallbackStatus = rules.computeEffectiveStatus(
        { status: 'TRIALING' },
        payment.membership.company.trialEndsAt
      );
      await tx.membership.update({
        where: { id: payment.membershipId },
        data: { status: fallbackStatus },
      });
    }

    await auditService.log(
      {
        companyId: null,
        userId: reviewerUserId,
        action: approve ? 'membership_payment.confirmed' : 'membership_payment.rejected',
        entityType: 'MembershipPayment',
        entityId: paymentId,
        oldValue: { status: 'PENDING_REVIEW' },
        newValue: { status: updatedPayment.status, reviewNote: note || null },
      },
      tx
    );

    return updatedPayment;
  });
}

module.exports = {
  listPlans,
  getActivePlan,
  getOrCreateMembership,
  getMembershipView,
  listOwnPayments,
  submitPayment,
  listPendingPayments,
  getPaymentProof,
  decidePayment,
};
