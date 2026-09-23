const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcDateOnly(date) {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

// Función pura: últimos `days` días terminando en `referenceDate`
// (incluida), en orden ascendente.
function lastDays(days, referenceDate) {
  const end = toUtcDateOnly(referenceDate);
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    dates.push(new Date(end.getTime() - i * MS_PER_DAY));
  }
  return dates;
}

// Función pura, genérica: suma diaria de `amountField` de `items`
// agrupados por `dateField`, para los últimos `days` días — sirve
// tanto para "facturado por día" como "cobrado por día" (métricas de
// flujo, no de saldo). Un día sin actividad aparece en 0, nunca se
// salta, para que el sparkline no dé un salto falso.
function buildDailyFlowTrend(items, dateField, amountField, days, referenceDate) {
  const dates = lastDays(days, referenceDate);
  const totalsByDay = new Map(dates.map((d) => [d.getTime(), new Decimal(0)]));

  for (const item of items) {
    const day = toUtcDateOnly(item[dateField]).getTime();
    if (!totalsByDay.has(day)) continue; // fuera del rango pedido
    totalsByDay.set(day, totalsByDay.get(day).plus(item[amountField]));
  }

  return dates.map((d) => ({
    date: d.toISOString().slice(0, 10),
    value: totalsByDay.get(d.getTime()).toFixed(2),
  }));
}

// Función pura: reconstruye, para cada uno de los últimos `days` días,
// el saldo total por cobrar y la porción vencida de ese saldo, TAL
// COMO se veían ese día — no una foto de hoy replicada hacia atrás.
// `invoices`: [{id, issueDate, dueDate, totalAmount}] (ya filtradas a
// no-CANCELLED). `applications`: [{invoiceId, amount, paymentDate}]
// (aplicaciones de cobro reales, con la fecha del cobro que las
// originó). Simplificación consciente y documentada: usa el
// `totalAmount` VIGENTE de cada factura durante todo el histórico —
// si una nota de crédito/débito cambió ese monto después de emitida,
// la reconstrucción de días anteriores a ese ajuste no lo refleja
// (mismo criterio de "aproximación honesta" que ya usa el proyecto en
// otros cálculos de tendencia, ej. Riesgo Financiero en Análisis
// Avanzados).
function buildReceivableBalanceTrend(invoices, applications, days, referenceDate) {
  const dates = lastDays(days, referenceDate);

  const appliedByInvoice = new Map();
  for (const app of applications) {
    if (!appliedByInvoice.has(app.invoiceId)) appliedByInvoice.set(app.invoiceId, []);
    appliedByInvoice.get(app.invoiceId).push(app);
  }

  return dates.map((d) => {
    let receivable = new Decimal(0);
    let overdue = new Decimal(0);

    for (const invoice of invoices) {
      const issueDate = toUtcDateOnly(invoice.issueDate);
      if (issueDate.getTime() > d.getTime()) continue; // todavía no existía ese día

      const appliedByD = (appliedByInvoice.get(invoice.id) || [])
        .filter((app) => toUtcDateOnly(app.paymentDate).getTime() <= d.getTime())
        .reduce((sum, app) => sum.plus(app.amount), new Decimal(0));

      const balance = new Decimal(invoice.totalAmount).minus(appliedByD);
      if (balance.lessThanOrEqualTo(0)) continue;

      receivable = receivable.plus(balance);
      if (toUtcDateOnly(invoice.dueDate).getTime() < d.getTime()) overdue = overdue.plus(balance);
    }

    return {
      date: d.toISOString().slice(0, 10),
      receivable: receivable.toFixed(2),
      overdue: overdue.toFixed(2),
    };
  });
}

module.exports = { buildDailyFlowTrend, buildReceivableBalanceTrend };
