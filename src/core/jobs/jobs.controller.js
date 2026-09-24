const asyncHandler = require('../utils/asyncHandler');
const { listJobDefinitions } = require('./job-registry');
const jobRunService = require('./job-run.service');

// "Trabajos automáticos": el catálogo de los 9 jobs + la última corrida
// real de cada uno para la empresa del usuario (o "nunca corrió" si
// todavía no hay ninguna fila) — así se responde de un vistazo lo que
// pedía la sección 17: última ejecución, resultado, duración, estado.
const status = asyncHandler(async (req, res) => {
  const definitions = listJobDefinitions();
  const lastRuns = await jobRunService.getLastRunsByJob(req.auth.companyId);
  res.json(
    definitions.map((job) => ({
      ...job,
      lastRun: lastRuns.get(job.key) || null,
    }))
  );
});

const runs = asyncHandler(async (req, res) => {
  const { jobKey, status: runStatus, from, to, limit } = req.query;
  const list = await jobRunService.listRuns(req.auth.companyId, {
    jobKey,
    status: runStatus,
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  res.json(list);
});

module.exports = { status, runs };
