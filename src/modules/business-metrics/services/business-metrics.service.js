const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const { computeMetricStats } = require('./business-metrics.rules');

async function createMetric(companyId, userId, data) {
  const existing = await prisma.businessMetric.findUnique({
    where: { companyId_name: { companyId, name: data.name } },
  });
  if (existing) {
    throw new AppError(`Ya existe una métrica con el nombre "${data.name}".`, 409, 'METRIC_EXISTS');
  }
  return prisma.businessMetric.create({
    data: {
      companyId,
      name: data.name,
      unit: data.unit || null,
      description: data.description || null,
      createdByUserId: userId,
    },
  });
}

async function listMetrics(companyId, { isActive } = {}) {
  return prisma.businessMetric.findMany({
    where: { companyId, isActive: isActive === undefined ? undefined : isActive },
    orderBy: { name: 'asc' },
  });
}

async function updateMetric(companyId, id, changes) {
  const metric = await prisma.businessMetric.findFirst({ where: { id, companyId } });
  if (!metric) {
    throw new AppError('La métrica indicada no existe.', 404, 'METRIC_NOT_FOUND');
  }
  return prisma.businessMetric.update({
    where: { id },
    data: {
      name: changes.name,
      unit: changes.unit,
      description: changes.description,
      isActive: changes.isActive,
    },
  });
}

async function assertMetricUsable(companyId, metricId) {
  const metric = await prisma.businessMetric.findFirst({ where: { id: metricId, companyId } });
  if (!metric) {
    throw new AppError('La métrica indicada no existe.', 404, 'METRIC_NOT_FOUND');
  }
  return metric;
}

async function addEntry(companyId, userId, metricId, data) {
  await assertMetricUsable(companyId, metricId);
  return prisma.businessMetricEntry.create({
    data: {
      metricId,
      date: data.date,
      value: data.value,
      note: data.note || null,
      createdByUserId: userId,
    },
  });
}

async function deleteEntry(companyId, metricId, entryId) {
  await assertMetricUsable(companyId, metricId);
  const entry = await prisma.businessMetricEntry.findFirst({ where: { id: entryId, metricId } });
  if (!entry) {
    throw new AppError('El registro indicado no existe.', 404, 'METRIC_ENTRY_NOT_FOUND');
  }
  await prisma.businessMetricEntry.delete({ where: { id: entryId } });
}

async function listEntries(companyId, metricId, { from, to } = {}) {
  await assertMetricUsable(companyId, metricId);
  return prisma.businessMetricEntry.findMany({
    where: { metricId, date: from || to ? { gte: from, lte: to } : undefined },
    orderBy: { date: 'asc' },
  });
}

async function getMetricStats(companyId, metricId, range = {}) {
  const entries = await listEntries(companyId, metricId, range);
  return computeMetricStats(entries);
}

module.exports = { createMetric, listMetrics, updateMetric, addEntry, deleteEntry, listEntries, getMetricStats };
