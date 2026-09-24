// Fase 11 (sección 17 — "última ejecución, resultado, error, duración,
// estado"): antes de esta fase, los 9 jobs automáticos del proyecto
// solo dejaban un `console.error` en el log del proceso si algo salía
// mal — sin ninguna forma de consultarlo después, ni de saber si un job
// corrió bien. `runJob` es un envoltorio genérico (no un motor de
// monitoreo nuevo): cada cron sigue exactamente igual que antes, solo
// que su llamada por-empresa pasa por acá, que mide el tiempo, atrapa
// el error, lo guarda en `JobRun` y VUELVE A LANZARLO — el `catch` que
// ya tenía cada archivo `*.cron.js` sigue viendo el mismo error de
// siempre y sigue logueándolo igual, cero cambio de comportamiento
// fuera de la fila nueva que queda guardada.
const prisma = require('../database/prisma');

async function runJob(jobKey, companyId, fn) {
  const startedAt = new Date();
  try {
    const result = await fn();
    const finishedAt = new Date();
    await prisma.jobRun.create({
      data: {
        companyId,
        jobKey,
        status: 'SUCCESS',
        startedAt,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      },
    });
    return result;
  } catch (err) {
    const finishedAt = new Date();
    await prisma.jobRun.create({
      data: {
        companyId,
        jobKey,
        status: 'ERROR',
        startedAt,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        errorMessage: String(err.message || err).slice(0, 1000),
      },
    });
    throw err;
  }
}

// Última corrida de cada job para una empresa (una fila por jobKey,
// la más reciente) — lo que alimenta el catálogo de "Trabajos
// automáticos". `companyId` requerido: mismo aislamiento multiempresa
// que el resto del proyecto (sección 19), nunca se mezclan corridas de
// dos empresas.
async function getLastRunsByJob(companyId) {
  const runs = await prisma.jobRun.findMany({
    where: { companyId },
    orderBy: { startedAt: 'desc' },
  });
  const lastByKey = new Map();
  for (const run of runs) {
    if (!lastByKey.has(run.jobKey)) lastByKey.set(run.jobKey, run);
  }
  return lastByKey;
}

// Historial filtrable, con paginación — mismo criterio de performance
// (sección 27) ya aplicado al resto de listados de auditoría: nunca
// devolver una tabla completa sin límite.
async function listRuns(companyId, { jobKey, status, from, to, limit = 100 } = {}) {
  return prisma.jobRun.findMany({
    where: {
      companyId,
      jobKey: jobKey || undefined,
      status: status || undefined,
      startedAt: from || to ? { gte: from, lte: to } : undefined,
    },
    orderBy: { startedAt: 'desc' },
    take: Math.min(limit, 500),
  });
}

module.exports = { runJob, getLastRunsByJob, listRuns };
