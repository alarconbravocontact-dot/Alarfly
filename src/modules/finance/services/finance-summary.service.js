// Fase 5 (Finanzas): capa de lectura/consolidación. NUNCA es una
// fuente de verdad nueva — cada número reutiliza exactamente el
// servicio que ya lo calcula en su módulo de origen (Tesorería/
// Reportes/Deuda), solo los junta en una sola respuesta pensada para
// responder las preguntas del usuario ("¿cuánto dinero tengo?", "¿cuánto
// me deben?", etc. — sección 7 del prompt de Fase 5) sin que tenga que
// visitar 3 módulos distintos. `modules/finance` puede depender de
// otros `modules/*` (mismo patrón ya establecido por `modules/reports`,
// que hace exactamente esto para Contabilidad/Tesorería/FP&A) — por
// eso esto NO vive en `core/`, que nunca depende de `modules/*`.
const { Prisma } = require('@prisma/client');
const prisma = require('../../../core/database/prisma');
const treasuryAccountsService = require('../../treasury/services/treasury-accounts.service');
const debtsService = require('../../treasury/services/debts.service');
const paymentOrdersService = require('../../treasury/services/payment-orders.service');
const liquidityForecastService = require('../../treasury/services/liquidity-forecast.service');
const agingService = require('../../reports/services/aging.service');
const personalDashboardService = require('../../personal/services/personal-dashboard.service');

// Roles con acceso real al módulo Personal (core/rbac/module-access.js
// — `personal: ['ADMIN', 'FINANCE']`). Finanzas es visible para más
// roles que Personal (incluye COLLABORATOR/ACCOUNTANT), así que la
// obligación de nómina/gastos de personal solo se agrega a la
// respuesta cuando quien pregunta ya tiene acceso real a Personal —
// nunca se "relaja" el acceso a Personal exponiendo sus montos por
// una puerta distinta a la que ya lo protege.
const PERSONAL_ROLES = ['ADMIN', 'FINANCE'];

const { Decimal } = Prisma;

// Suma el saldo pendiente de todos los préstamos (LOAN) activos,
// convertido a moneda base con el MISMO convertToBase que ya usa la
// posición de caja consolidada para las líneas de crédito — nunca una
// segunda rutina de conversión. Las líneas de crédito (CREDIT_LINE) no
// se sumen acá: su disponible ya lo reporta getConsolidatedCashPosition
// como parte del colchón de liquidez, sumarlas de nuevo sería contar el
// mismo dato dos veces con otro signo.
async function getOutstandingLoansTotal(companyId, baseCurrency, asOfDate) {
  const loans = await debtsService.listDebts(companyId, { type: 'LOAN', status: 'ACTIVE' });
  const missingRates = [];
  let total = new Decimal(0);
  for (const loan of loans) {
    const converted = await treasuryAccountsService.convertToBase(
      companyId,
      baseCurrency,
      new Decimal(loan.outstandingBalance),
      loan.currency,
      asOfDate,
      missingRates,
      loan.id
    );
    if (converted !== null) total = total.plus(converted);
  }
  return { total: total.toFixed(2), missingRates };
}

// Suma lo comprometido: órdenes de pago que ya existen pero TODAVÍA no
// se ejecutaron (ni aprobadas ni pagadas) — DRAFT/PENDING_APPROVAL. Una
// orden APPROVED ya salió de caja (postea su asiento y descuenta el
// saldo en el momento de la última aprobación, ver
// payment-orders.service.decideApproval) así que ya está reflejada en
// "cuánto dinero tengo", contarla acá la duplicaría.
async function getCommittedPaymentOrdersTotal(companyId) {
  const [draft, pendingApproval] = await Promise.all([
    paymentOrdersService.listPaymentOrders(companyId, { status: 'DRAFT' }),
    paymentOrdersService.listPaymentOrders(companyId, { status: 'PENDING_APPROVAL' }),
  ]);
  const orders = [...draft, ...pendingApproval];
  const total = orders.reduce((sum, order) => sum.plus(order.amount), new Decimal(0));
  return { total: total.toFixed(2), count: orders.length };
}

// Resumen financiero (sección 7): responde en una sola llamada las
// preguntas que hoy exigían visitar Tesorería + Reportes + Deuda por
// separado. Cada campo documenta explícitamente de qué servicio viene.
async function getFinanceSummary(companyId, role) {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  const asOfDate = new Date();

  const [cashPosition, receivablesAging, payablesAging, loans, committed, liquidityForecast, personnelObligations] = await Promise.all([
    treasuryAccountsService.getConsolidatedCashPosition(companyId, asOfDate),
    agingService.getReceivablesAging(companyId, asOfDate),
    agingService.getPayablesAging(companyId, asOfDate),
    getOutstandingLoansTotal(companyId, company.baseCurrency, asOfDate),
    getCommittedPaymentOrdersTotal(companyId),
    liquidityForecastService.getLiquidityForecast(companyId, { weeks: 8 }),
    // Obligaciones de nómina/gastos de personal: ya reconocidas en el
    // Ledger (ver core/ledger.postEntry en payroll.service/
    // employee-expenses.service), todavía sin una PaymentOrder —
    // `totalPayable` de arriba no las incluye porque solo agrega
    // ApBill, y Personal nunca escribe esa tabla (no se duplica AP).
    PERSONAL_ROLES.includes(role) ? personalDashboardService.getObligationsSummary(companyId) : Promise.resolve(null),
  ]);

  // "Cuánto espero cobrar/pagar en lo inmediato" (a diferencia del saldo
  // TOTAL abierto de arriba, que incluye vencimientos lejanos): suma de
  // los movimientos que la Previsión de Liquidez ya reparte semana a
  // semana en las próximas 8 semanas — no se vuelve a calcular nada, se
  // agregan números que ese servicio ya devuelve.
  const nearTermInflows = liquidityForecast.weeks
    .reduce((sum, week) => sum.plus(week.expectedInflows), new Decimal(0))
    .toFixed(2);
  const nearTermOutflows = liquidityForecast.weeks
    .reduce((sum, week) => sum.plus(week.expectedOutflows), new Decimal(0))
    .toFixed(2);

  return {
    asOfDate,
    baseCurrency: company.baseCurrency,
    // ¿Cuánto dinero tengo?
    cashOnHand: cashPosition.totalInBaseCurrency,
    // ¿Cuánto tengo disponible? (caja + líneas de crédito sin usar)
    availableLiquidity: cashPosition.liquidityCushion,
    // ¿Cuánto me deben? (fuente: reports/aging.service, la misma que
    // usa Reportes > Antigüedad de Saldos — nunca un segundo cálculo)
    totalReceivable: receivablesAging.totalOutstanding,
    // ¿Cuánto de eso ya está vencido? (Fase 9, Centro Operativo: todo lo
    // que NO cae en el balde "CURRENT" de la MISMA agregación de arriba
    // — nunca una segunda consulta ni una segunda regla de qué es
    // "vencido", ya la define aging.rules.classifyAgingBucket).
    overdueReceivable: new Decimal(receivablesAging.totalOutstanding).minus(receivablesAging.totalsByBucket.CURRENT).toFixed(2),
    // ¿Cuánto debo? (proveedores, misma fuente que Antigüedad de Saldos)
    totalPayable: payablesAging.totalOutstanding,
    // ¿Cuánto debo de financiamiento? (préstamos activos; las líneas de
    // crédito ya están reflejadas en availableLiquidity, no se duplican)
    totalDebt: loans.total,
    // ¿Cuánto tengo comprometido? (órdenes de pago creadas, sin ejecutar)
    committedPayments: committed.total,
    // ¿Cuánto espero cobrar/pagar pronto? (próximas 8 semanas reales,
    // vía la Previsión de Liquidez ya existente)
    expectedNearTermInflows: nearTermInflows,
    expectedNearTermOutflows: nearTermOutflows,
    firstNegativeWeek: liquidityForecast.firstNegativeWeek,
    missingExchangeRates: [...cashPosition.missingExchangeRates, ...loans.missingRates],
    // ¿Cuánto debo de nómina/gastos de personal? `null` para un rol sin
    // acceso a Personal (Colaborador/Contador) — ver PERSONAL_ROLES
    // arriba. Las obligaciones YA están reconocidas en el Ledger
    // (core/ledger.postEntry, cuentas de pasivo configuradas en
    // PersonalSettings); acá solo se leen y se suman, sin recalcular
    // ni duplicar ese asiento.
    personnelObligations: personnelObligations && {
      payrollPendingPayment: personnelObligations.payrollPendingPayment.total,
      expensesPendingReimbursement: personnelObligations.expensesPendingReimbursement.total,
    },
  };
}

module.exports = { getFinanceSummary };
