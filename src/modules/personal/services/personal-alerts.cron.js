const cron = require('node-cron');
const prisma = require('../../../core/database/prisma');
const personalAlertsService = require('./personal-alerts.service');
const { runJob } = require('../../../core/jobs/job-run.service');

// Corre todos los días a las 7:20am (después de Análisis Avanzados,
// 7:15am — mismo criterio del resto del proyecto de no competir por el
// mismo minuto). Escanea nóminas/gastos de personal pendientes de
// acción para cada empresa, vía el motor de alertas ya existente.
function schedule() {
  cron.schedule('20 7 * * *', async () => {
    const companies = await prisma.company.findMany({ select: { id: true } });
    for (const company of companies) {
      try {
        await runJob('personal.alerts-scan', company.id, () => personalAlertsService.scanPendingActions(company.id));
      } catch (err) {
        console.error(`Error corriendo el escaneo de alertas de Personal de la empresa ${company.id}:`, err.message);
      }
    }
  });
}

module.exports = { schedule };
