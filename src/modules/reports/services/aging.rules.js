const { Prisma } = require('@prisma/client');

const { Decimal } = Prisma;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const BUCKETS = ['CURRENT', 'DAYS_1_30', 'DAYS_31_60', 'DAYS_61_90', 'DAYS_90_PLUS'];

// Función pura: cuántos días pasaron desde el vencimiento hasta la
// fecha de corte (negativo = todavía no vence).
function daysOverdue(dueDate, asOfDate) {
  return Math.floor((asOfDate.getTime() - dueDate.getTime()) / MS_PER_DAY);
}

// Función pura: clasifica los días de atraso en el balde estándar de
// antigüedad de saldos.
function classifyAgingBucket(days) {
  if (days <= 0) return 'CURRENT';
  if (days <= 30) return 'DAYS_1_30';
  if (days <= 60) return 'DAYS_31_60';
  if (days <= 90) return 'DAYS_61_90';
  return 'DAYS_90_PLUS';
}

// Función pura: dado un listado de saldos abiertos (con su fecha de
// vencimiento y contraparte), arma el reporte de antigüedad agrupado
// por balde y por contraparte.
function buildAgingReport(items, asOfDate) {
  const byBucket = Object.fromEntries(BUCKETS.map((bucket) => [bucket, new Decimal(0)]));
  const rows = items.map((item) => {
    const days = daysOverdue(item.dueDate, asOfDate);
    const bucket = classifyAgingBucket(days);
    const balance = new Decimal(item.balance);
    byBucket[bucket] = byBucket[bucket].plus(balance);
    return { ...item, daysOverdue: days, bucket, balance: balance.toFixed(2) };
  });

  const totalsByBucket = Object.fromEntries(BUCKETS.map((bucket) => [bucket, byBucket[bucket].toFixed(2)]));
  const totalOutstanding = Object.values(byBucket).reduce((sum, v) => sum.plus(v), new Decimal(0));

  return { asOfDate, rows, totalsByBucket, totalOutstanding: totalOutstanding.toFixed(2) };
}

module.exports = { daysOverdue, classifyAgingBucket, buildAgingReport, BUCKETS };
