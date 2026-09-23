const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');

async function listBenchmarks(companyId) {
  return prisma.analysisBenchmarkValue.findMany({ where: { companyId }, orderBy: { label: 'asc' } });
}

// Solo Administrador puede llegar acá (aplicado en la ruta) — un valor
// de referencia de industria es una entrada manual que afecta cómo se
// interpretan los resultados de toda la empresa, no una preferencia
// personal.
async function upsertBenchmark(companyId, userId, { metricKey, label, industryValue, unit }) {
  return prisma.analysisBenchmarkValue.upsert({
    where: { companyId_metricKey: { companyId, metricKey } },
    create: { companyId, metricKey, label, industryValue, unit: unit || null, updatedByUserId: userId },
    update: { label, industryValue, unit: unit || null, updatedByUserId: userId },
  });
}

async function deleteBenchmark(companyId, metricKey) {
  const existing = await prisma.analysisBenchmarkValue.findUnique({ where: { companyId_metricKey: { companyId, metricKey } } });
  if (!existing) {
    throw new AppError('Ese valor de referencia no existe.', 404, 'BENCHMARK_NOT_FOUND');
  }
  await prisma.analysisBenchmarkValue.delete({ where: { companyId_metricKey: { companyId, metricKey } } });
}

module.exports = { listBenchmarks, upsertBenchmark, deleteBenchmark };
