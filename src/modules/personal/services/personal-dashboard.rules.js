// Función pura (sin acceso a base de datos), mismo patrón que
// `ar-invoices.rules.buildSalesTrend`: un punto por cada uno de los
// últimos `months` meses, en 0 si no hubo costo real ese mes — nunca
// "saltado", para que el gráfico nunca mienta sobre la continuidad.
const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;

function bucketKeyFor(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function buildCostTrend(paidPayrolls, reimbursedExpenses, months, referenceDate) {
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const bucketDate = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - i, 1));
    buckets.push({ key: bucketKeyFor(bucketDate), date: bucketDate, value: new Decimal(0) });
  }
  const bucketByKey = new Map(buckets.map((b) => [b.key, b]));

  for (const payroll of paidPayrolls) {
    const bucket = bucketByKey.get(bucketKeyFor(payroll.paymentDate));
    if (bucket) bucket.value = bucket.value.plus(payroll.netTotal);
  }
  for (const expense of reimbursedExpenses) {
    const bucket = bucketByKey.get(bucketKeyFor(expense.reimbursedAt));
    if (bucket) bucket.value = bucket.value.plus(expense.amount);
  }

  return buckets.map((b) => ({ date: b.date, value: b.value.toFixed(2) }));
}

module.exports = { buildCostTrend };
