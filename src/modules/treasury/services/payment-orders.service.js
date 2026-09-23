const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const auditService = require('../../../core/audit/audit.service');
const ledgerService = require('../../../core/ledger/ledger.service');
const periodLockService = require('../../../core/period-lock/period-lock.service');
const { assertPeriodOpen } = require('../../../core/period-lock/period-lock.rules');
const arApSettingsService = require('../../../core/ar-ap-settings/ar-ap-settings.service');
const { applyPaymentToBills } = require('../../accounts-payable/services/ap-bills.rules');
const { findMatchingRule, assertCanApprove, nextApprovalLevel, isFullyApproved } = require('./payment-approval.rules');

const { Decimal } = Prisma;

async function createPaymentOrder(companyId, userId, data) {
  const treasuryAccount = await prisma.treasuryAccount.findFirst({
    where: { id: data.treasuryAccountId, companyId },
  });
  if (!treasuryAccount) {
    throw new AppError('La cuenta de tesorería indicada no existe.', 404, 'TREASURY_ACCOUNT_NOT_FOUND');
  }
  const glAccount = await prisma.account.findFirst({ where: { id: data.glAccountId, companyId } });
  if (!glAccount) {
    throw new AppError('La cuenta contable indicada no existe.', 404, 'ACCOUNT_NOT_FOUND');
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.paymentOrder.create({ data: { companyId, createdByUserId: userId, ...data } });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'payment_order.created',
        entityType: 'PaymentOrder',
        entityId: order.id,
        oldValue: null,
        newValue: order,
      },
      tx
    );
    return order;
  });
}

// Conexión con AP: en vez de un beneficiario libre, se paga a un
// proveedor real del catálogo y se indica qué factura(s) cubre. La
// orden pasa por el MISMO flujo de aprobación multinivel de siempre —
// lo único distinto es que, al completarse la última aprobación,
// además de postear el asiento se genera el ApPayment/
// ApPaymentApplication (ver decideApproval más abajo).
async function createPaymentOrderForVendorBills(companyId, userId, data) {
  const vendor = await prisma.vendor.findFirst({ where: { id: data.vendorId, companyId } });
  if (!vendor) {
    throw new AppError('El proveedor indicado no existe.', 404, 'VENDOR_NOT_FOUND');
  }
  const treasuryAccount = await prisma.treasuryAccount.findFirst({ where: { id: data.treasuryAccountId, companyId } });
  if (!treasuryAccount) {
    throw new AppError('La cuenta de tesorería indicada no existe.', 404, 'TREASURY_ACCOUNT_NOT_FOUND');
  }
  const payableGlAccountId = await arApSettingsService.assertPayableAccountConfigured(companyId);

  const billIds = data.applications.map((application) => application.apBillId);
  const bills = await prisma.apBill.findMany({ where: { id: { in: billIds }, companyId, vendorId: vendor.id } });
  const billsById = new Map(bills.map((bill) => [bill.id, bill]));

  const amount = data.applications.reduce((sum, application) => sum.plus(application.amount), new Decimal(0));
  // Solo para validar que los montos aplicados no superen el saldo
  // pendiente de cada factura — el resultado se descarta acá, se
  // vuelve a calcular al aprobar (el saldo puede moverse mientras
  // tanto por otro pago).
  applyPaymentToBills(amount, data.applications.map((a) => ({ billId: a.apBillId, amount: a.amount })), billsById);

  return prisma.$transaction(async (tx) => {
    const order = await tx.paymentOrder.create({
      data: {
        companyId,
        createdByUserId: userId,
        vendorId: vendor.id,
        treasuryAccountId: data.treasuryAccountId,
        glAccountId: payableGlAccountId,
        payeeName: vendor.name,
        amount,
        currency: data.currency,
        description: data.description,
        scheduledDate: data.scheduledDate,
        billApplications: {
          create: data.applications.map((application) => ({ apBillId: application.apBillId, amount: application.amount })),
        },
      },
      include: { billApplications: true },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'payment_order.created',
        entityType: 'PaymentOrder',
        entityId: order.id,
        oldValue: null,
        newValue: order,
      },
      tx
    );
    return order;
  });
}

async function submitForApproval(companyId, id, userId) {
  const order = await prisma.paymentOrder.findFirst({ where: { id, companyId } });
  if (!order) {
    throw new AppError('La orden de pago indicada no existe.', 404, 'PAYMENT_ORDER_NOT_FOUND');
  }
  if (order.status !== 'DRAFT') {
    throw new AppError('Solo se pueden enviar a aprobación órdenes en borrador.', 409, 'INVALID_STATUS');
  }

  const rules = await prisma.paymentApprovalRule.findMany({
    where: { companyId, isActive: true },
    include: { levels: true },
  });
  const rule = findMatchingRule(rules, order.amount);
  if (!rule) {
    throw new AppError(
      'No hay una regla de aprobación configurada para este monto. Configúrala antes de enviar la orden.',
      400,
      'NO_APPROVAL_RULE_MATCHED'
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.paymentOrder.update({
      where: { id },
      data: { status: 'PENDING_APPROVAL', approvalRuleId: rule.id, requiredLevels: rule.levels?.length || 1 },
    });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'payment_order.submitted',
        entityType: 'PaymentOrder',
        entityId: id,
        oldValue: { status: 'DRAFT' },
        newValue: { status: 'PENDING_APPROVAL', requiredLevels: updated.requiredLevels },
      },
      tx
    );
    return updated;
  });
}

// El corazón del flujo multinivel: registra la decisión del nivel que
// corresponde, y si con esta ya se completaron todos los niveles
// requeridos, postea el asiento contable vía core/ledger y descuenta el
// saldo de la cuenta de tesorería.
async function decideApproval(companyId, id, approverUserId, { decision, comment }) {
  const order = await prisma.paymentOrder.findFirst({
    where: { id, companyId },
    include: { approvalRule: { include: { levels: true } }, approvals: true, treasuryAccount: true, billApplications: true },
  });
  if (!order) {
    throw new AppError('La orden de pago indicada no existe.', 404, 'PAYMENT_ORDER_NOT_FOUND');
  }

  const approver = await prisma.user.findUnique({ where: { id: approverUserId } });
  const level = nextApprovalLevel(order.approvals);
  const levelConfig = order.approvalRule?.levels.find((l) => l.level === level);

  assertCanApprove({
    order,
    existingApprovals: order.approvals,
    level,
    allowedRolesForLevel: levelConfig?.allowedRoles,
    approverUserId,
    approverRole: approver.role,
  });

  if (decision === 'REJECTED') {
    return prisma.$transaction(async (tx) => {
      await tx.paymentApproval.create({
        data: { paymentOrderId: id, level, decision, comment, approvedByUserId: approverUserId },
      });
      const updated = await tx.paymentOrder.update({ where: { id }, data: { status: 'REJECTED' } });
      await auditService.log(
        {
          companyId,
          userId: approverUserId,
          action: 'payment_order.rejected',
          entityType: 'PaymentOrder',
          entityId: id,
          oldValue: { status: 'PENDING_APPROVAL' },
          newValue: { status: 'REJECTED', level, comment },
        },
        tx
      );
      return updated;
    });
  }

  const completesApproval = isFullyApproved(level, order.requiredLevels);

  if (!completesApproval) {
    return prisma.$transaction(async (tx) => {
      await tx.paymentApproval.create({
        data: { paymentOrderId: id, level, decision, comment, approvedByUserId: approverUserId },
      });
      await auditService.log(
        {
          companyId,
          userId: approverUserId,
          action: 'payment_order.level_approved',
          entityType: 'PaymentOrder',
          entityId: id,
          oldValue: null,
          newValue: { level, requiredLevels: order.requiredLevels },
        },
        tx
      );
      return tx.paymentOrder.findUnique({ where: { id } });
    });
  }

  // Último nivel: hay que postear el asiento contable. Respeta el
  // bloqueo de periodo — si está cerrado, la aprobación se rechaza con
  // un error claro y la orden se queda pendiente (no se pierde el
  // trabajo de las aprobaciones ya dadas).
  const period = await periodLockService.getPeriodForDate(companyId, order.scheduledDate);
  assertPeriodOpen(period);

  // Si esta orden paga facturas de AP, se valida (y se recalcula, por
  // si el saldo de alguna factura se movió desde que se creó la orden)
  // ANTES de postear el asiento — igual criterio que el resto del
  // proyecto: nunca postear un asiento que después no se pueda aplicar.
  let billApplicationResults = null;
  if (order.vendorId && order.billApplications.length > 0) {
    const billIds = order.billApplications.map((application) => application.apBillId);
    const bills = await prisma.apBill.findMany({ where: { id: { in: billIds }, companyId, vendorId: order.vendorId } });
    const billsById = new Map(bills.map((bill) => [bill.id, bill]));
    billApplicationResults = applyPaymentToBills(
      order.amount,
      order.billApplications.map((application) => ({ billId: application.apBillId, amount: application.amount })),
      billsById
    );
  }

  const entry = await ledgerService.postEntry({
    companyId,
    date: order.scheduledDate,
    description: `Pago a ${order.payeeName}: ${order.description}`,
    lines: [
      { accountId: order.glAccountId, debit: Number(order.amount), credit: 0 },
      { accountId: order.treasuryAccount.glAccountId, debit: 0, credit: Number(order.amount) },
    ],
    origin: 'AUTOMATIC',
    sourceModule: 'treasury',
    sourceReference: id,
    createdByUserId: approverUserId,
    autoApprove: true,
  });

  return prisma.$transaction(async (tx) => {
    await tx.paymentApproval.create({
      data: { paymentOrderId: id, level, decision, comment, approvedByUserId: approverUserId },
    });
    const updated = await tx.paymentOrder.update({
      where: { id },
      data: { status: 'APPROVED', paidJournalEntryId: entry.id },
    });
    await tx.treasuryAccount.update({
      where: { id: order.treasuryAccountId },
      data: { currentBalance: { decrement: order.amount } },
    });

    if (billApplicationResults) {
      const payment = await tx.apPayment.create({
        data: {
          companyId,
          vendorId: order.vendorId,
          date: order.scheduledDate,
          amount: order.amount,
          treasuryAccountId: order.treasuryAccountId,
          journalEntryId: entry.id,
          createdByUserId: approverUserId,
          applications: {
            create: billApplicationResults.map((result) => ({ billId: result.billId, amount: result.amount })),
          },
        },
      });
      for (const result of billApplicationResults) {
        await tx.apBill.update({ where: { id: result.billId }, data: { paidAmount: result.newPaidAmount, status: result.newStatus } });
      }
      await auditService.log(
        {
          companyId,
          userId: approverUserId,
          action: 'ap_payment.recorded',
          entityType: 'ApPayment',
          entityId: payment.id,
          oldValue: null,
          newValue: payment,
        },
        tx
      );
    }

    await auditService.log(
      {
        companyId,
        userId: approverUserId,
        action: 'payment_order.fully_approved',
        entityType: 'PaymentOrder',
        entityId: id,
        oldValue: { status: 'PENDING_APPROVAL' },
        newValue: { status: 'APPROVED', journalEntryId: entry.id },
      },
      tx
    );
    return updated;
  });
}

async function cancelPaymentOrder(companyId, id, userId) {
  const order = await prisma.paymentOrder.findFirst({ where: { id, companyId } });
  if (!order) {
    throw new AppError('La orden de pago indicada no existe.', 404, 'PAYMENT_ORDER_NOT_FOUND');
  }
  if (!['DRAFT', 'PENDING_APPROVAL'].includes(order.status)) {
    throw new AppError('Solo se pueden cancelar órdenes en borrador o pendientes de aprobación.', 409, 'INVALID_STATUS');
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.paymentOrder.update({ where: { id }, data: { status: 'CANCELLED' } });
    await auditService.log(
      {
        companyId,
        userId,
        action: 'payment_order.cancelled',
        entityType: 'PaymentOrder',
        entityId: id,
        oldValue: { status: order.status },
        newValue: { status: 'CANCELLED' },
      },
      tx
    );
    return updated;
  });
}

async function listPaymentOrders(companyId, { status, treasuryAccountId } = {}) {
  return prisma.paymentOrder.findMany({
    where: { companyId, status: status || undefined, treasuryAccountId: treasuryAccountId || undefined },
    orderBy: { createdAt: 'desc' },
  });
}

async function getPaymentOrder(companyId, id) {
  const order = await prisma.paymentOrder.findFirst({
    where: { id, companyId },
    include: {
      approvals: { include: { approvedByUser: { select: { id: true, name: true, role: true } } }, orderBy: { level: 'asc' } },
      approvalRule: { include: { levels: true } },
    },
  });
  if (!order) {
    throw new AppError('La orden de pago indicada no existe.', 404, 'PAYMENT_ORDER_NOT_FOUND');
  }
  return order;
}

module.exports = {
  createPaymentOrder,
  createPaymentOrderForVendorBills,
  submitForApproval,
  decideApproval,
  cancelPaymentOrder,
  listPaymentOrders,
  getPaymentOrder,
};
