const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const coreAlertsService = require('../../../core/alerts/alerts.service');
const {
  detectLowBalance,
  detectCreditCardNearLimit,
  detectPaymentDueSoon,
  severityForPaymentDueSoon,
  detectRecurringLateCustomer,
} = require('./alerts.rules');
const { isDisconnected } = require('./bank-sync.rules');

const { Decimal } = Prisma;
const { createAlertIfNotExists, createRule, listRules, deactivateRule, listAlerts, acknowledgeAlert } = coreAlertsService;

async function scanLowBalances(companyId) {
  const created = [];

  const accounts = await prisma.treasuryAccount.findMany({
    where: { companyId, isActive: true, type: 'BANK_ACCOUNT', lowBalanceThreshold: { not: null } },
  });
  for (const account of accounts) {
    if (detectLowBalance(account.currentBalance, account.lowBalanceThreshold)) {
      const alert = await createAlertIfNotExists({
        companyId,
        ruleId: null,
        type: 'LOW_BALANCE',
        severity: 'WARNING',
        message: `La cuenta "${account.name}" tiene saldo bajo (${account.currentBalance.toFixed(2)} ${account.currency}).`,
        entityType: 'TreasuryAccount',
        entityId: account.id,
      });
      if (alert) created.push(alert);
    }
  }

  const funds = await prisma.pettyCashFund.findMany({ where: { companyId, status: 'ACTIVE' } });
  for (const fund of funds) {
    if (detectLowBalance(fund.currentBalance, fund.replenishmentThreshold)) {
      const alert = await createAlertIfNotExists({
        companyId,
        ruleId: null,
        type: 'LOW_BALANCE',
        severity: 'WARNING',
        message: `El fondo de caja chica "${fund.name}" necesita reposición (saldo: ${fund.currentBalance.toFixed(2)}).`,
        entityType: 'PettyCashFund',
        entityId: fund.id,
      });
      if (alert) created.push(alert);
    }
  }

  return created;
}

async function scanCreditCardsNearLimit(companyId) {
  const rule = await prisma.alertRule.findFirst({ where: { companyId, type: 'CREDIT_CARD_NEAR_LIMIT', isActive: true } });
  if (!rule) return [];
  const warningPercentage = rule.parameters?.warningPercentage ?? 90;

  const cards = await prisma.treasuryAccount.findMany({
    where: { companyId, isActive: true, type: 'CREDIT_CARD', creditLimit: { not: null } },
  });

  const created = [];
  for (const card of cards) {
    if (detectCreditCardNearLimit(card.currentBalance, card.creditLimit, warningPercentage)) {
      const alert = await createAlertIfNotExists({
        companyId,
        ruleId: rule.id,
        type: 'CREDIT_CARD_NEAR_LIMIT',
        severity: 'WARNING',
        message: `La tarjeta "${card.name}" está cerca de su límite (${card.currentBalance.toFixed(2)} de ${card.creditLimit.toFixed(2)}).`,
        entityType: 'TreasuryAccount',
        entityId: card.id,
      });
      if (alert) created.push(alert);
    }
  }
  return created;
}

async function scanPaymentsDueSoon(companyId) {
  const rule = await prisma.alertRule.findFirst({ where: { companyId, type: 'PAYMENT_DUE_SOON', isActive: true } });
  if (!rule) return [];
  const daysBefore = rule.parameters?.daysBefore ?? 3;
  const today = new Date();
  const created = [];

  const orders = await prisma.paymentOrder.findMany({
    where: { companyId, status: { in: ['PENDING_APPROVAL', 'APPROVED'] } },
  });
  for (const order of orders) {
    if (detectPaymentDueSoon(order.scheduledDate, today, daysBefore)) {
      const alert = await createAlertIfNotExists({
        companyId,
        ruleId: rule.id,
        type: 'PAYMENT_DUE_SOON',
        severity: severityForPaymentDueSoon(order.scheduledDate, today),
        message: `El pago a "${order.payeeName}" por ${order.amount.toFixed(2)} ${order.currency} vence el ${order.scheduledDate.toISOString().slice(0, 10)}.`,
        entityType: 'PaymentOrder',
        entityId: order.id,
      });
      if (alert) created.push(alert);
    }
  }

  const installments = await prisma.debtInstallment.findMany({
    where: { status: 'PENDING', debt: { companyId } },
    include: { debt: true },
  });
  for (const installment of installments) {
    if (detectPaymentDueSoon(installment.dueDate, today, daysBefore)) {
      const total = new Decimal(installment.principalPortion).plus(installment.interestPortion);
      const alert = await createAlertIfNotExists({
        companyId,
        ruleId: rule.id,
        type: 'PAYMENT_DUE_SOON',
        severity: severityForPaymentDueSoon(installment.dueDate, today),
        message: `La cuota ${installment.installmentNumber} del préstamo "${installment.debt.name}" (${total.toFixed(2)}) vence el ${installment.dueDate.toISOString().slice(0, 10)}.`,
        entityType: 'DebtInstallment',
        entityId: installment.id,
      });
      if (alert) created.push(alert);
    }
  }

  // F12-A (Automatización Determinística), punto 7: "cuentas por pagar
  // próximas a vencer" no tenía ninguna alerta — a diferencia de las
  // Cuentas por Cobrar (que ya avisan por CUSTOMER_RECURRING_LATE_
  // PAYMENT/AR_COLLECTION_ESCALATION), ninguna factura de compra (AP)
  // generaba aviso alguno de vencimiento. Se resuelve reutilizando
  // exactamente el mismo tipo PAYMENT_DUE_SOON, la misma regla/umbral
  // ya configurado (nunca uno nuevo) y la misma función pura de
  // detección que ya usan Órdenes de Pago y Cuotas de Deuda arriba —
  // no se creó ningún AlertType, AlertRule, cron ni motor nuevo.
  const bills = await prisma.apBill.findMany({
    where: { companyId, status: { in: ['OPEN', 'PARTIALLY_PAID'] } },
    include: { vendor: true },
  });
  if (bills.length > 0) {
    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { baseCurrency: true } });
    for (const bill of bills) {
      if (detectPaymentDueSoon(bill.dueDate, today, daysBefore)) {
        const outstanding = new Decimal(bill.totalAmount).minus(bill.paidAmount);
        const alert = await createAlertIfNotExists({
          companyId,
          ruleId: rule.id,
          type: 'PAYMENT_DUE_SOON',
          severity: severityForPaymentDueSoon(bill.dueDate, today),
          message: `La factura de compra N.º ${bill.billNumber} de "${bill.vendor.name}" (${outstanding.toFixed(2)} ${company.baseCurrency}) vence el ${bill.dueDate.toISOString().slice(0, 10)}.`,
          entityType: 'ApBill',
          entityId: bill.id,
        });
        if (alert) created.push(alert);
      }
    }
  }

  return created;
}

// Punto 9, la parte que había quedado bloqueada esperando AR: agrupa
// las facturas de venta vencidas por cliente (dato que ya guarda AR,
// no se duplica nada) y alerta a los clientes que superan el umbral
// configurado de facturas vencidas simultáneas.
async function scanRecurringLateCustomers(companyId) {
  const rule = await prisma.alertRule.findFirst({ where: { companyId, type: 'CUSTOMER_RECURRING_LATE_PAYMENT', isActive: true } });
  if (!rule) return [];
  const minOccurrences = rule.parameters?.minOccurrences ?? 2;
  const today = new Date();

  const overdueInvoices = await prisma.arInvoice.findMany({
    where: { companyId, status: { in: ['OPEN', 'PARTIALLY_PAID'] }, dueDate: { lt: today } },
    include: { customer: true },
  });

  const byCustomer = new Map();
  for (const invoice of overdueInvoices) {
    const entry = byCustomer.get(invoice.customerId) || { customer: invoice.customer, count: 0 };
    entry.count += 1;
    byCustomer.set(invoice.customerId, entry);
  }

  const created = [];
  for (const { customer, count } of byCustomer.values()) {
    if (!detectRecurringLateCustomer(count, minOccurrences)) continue;
    const alert = await createAlertIfNotExists({
      companyId,
      ruleId: rule.id,
      type: 'CUSTOMER_RECURRING_LATE_PAYMENT',
      severity: 'WARNING',
      message: `El cliente "${customer.name}" tiene ${count} facturas vencidas al mismo tiempo.`,
      entityType: 'Customer',
      entityId: customer.id,
    });
    if (alert) created.push(alert);
  }
  return created;
}

// Indicador de sincronización, la parte automática: si una cuenta
// bancaria lleva 48h+ sin un extracto importado (el mismo umbral RED
// que ya usa el indicador visual junto a cada cuenta), sube una
// notificación al Centro de Notificaciones — sin exigir un AlertRule
// configurado antes, mismo criterio que scanLowBalances (el umbral es
// una regla de negocio fija que pidió el usuario, no una que el
// Administrador deba configurar).
async function scanDisconnectedBankAccounts(companyId) {
  const accounts = await prisma.treasuryAccount.findMany({
    where: { companyId, isActive: true, type: 'BANK_ACCOUNT' },
    include: { statementImports: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });
  const now = new Date();
  const created = [];
  for (const account of accounts) {
    const lastSyncAt = account.statementImports[0]?.createdAt || null;
    if (!isDisconnected(lastSyncAt, now)) continue;
    const sinceText = lastSyncAt
      ? `desde el ${lastSyncAt.toISOString().slice(0, 10)}`
      : 'nunca se ha importado un extracto para esta cuenta';
    const alert = await createAlertIfNotExists({
      companyId,
      ruleId: null,
      type: 'BANK_ACCOUNT_DISCONNECTED',
      severity: 'CRITICAL',
      message: `La cuenta "${account.name}" lleva más de 48 horas sin sincronizar (${sinceText}).`,
      entityType: 'TreasuryAccount',
      entityId: account.id,
    });
    if (alert) created.push(alert);
  }
  return created;
}

async function runAlertsScan(companyId) {
  const [lowBalances, creditCardsNearLimit, paymentsDueSoon, recurringLateCustomers, disconnectedBankAccounts] =
    await Promise.all([
      scanLowBalances(companyId),
      scanCreditCardsNearLimit(companyId),
      scanPaymentsDueSoon(companyId),
      scanRecurringLateCustomers(companyId),
      scanDisconnectedBankAccounts(companyId),
    ]);
  return {
    lowBalances,
    creditCardsNearLimit,
    paymentsDueSoon,
    recurringLateCustomers,
    disconnectedBankAccounts,
    totalCreated:
      lowBalances.length +
      creditCardsNearLimit.length +
      paymentsDueSoon.length +
      recurringLateCustomers.length +
      disconnectedBankAccounts.length,
  };
}

module.exports = {
  createRule,
  listRules,
  deactivateRule,
  runAlertsScan,
  listAlerts,
  acknowledgeAlert,
};
