const cron = require('node-cron');
const prisma = require('../../../core/database/prisma');
const scheduledReportsService = require('./scheduled-reports.service');
const { isDue } = require('./scheduled-reports.rules');
const { runJob } = require('../../../core/jobs/job-run.service');

// Corre todos los días a las 7am (después de los escaneos de alertas
// de Tesorería y Fiscal): genera el archivo de cada reporte programado
// que ya cumplió su frecuencia. NO envía nada todavía — ver la nota en
// scheduled-reports.service.js sobre notifyAlert().
function schedule() {
  cron.schedule('0 7 * * *', async () => {
    const scheduledReports = await prisma.scheduledReport.findMany({ where: { isActive: true } });
    const now = new Date();
    for (const scheduledReport of scheduledReports) {
      if (!isDue(scheduledReport.frequency, scheduledReport.lastRunAt, now)) continue;
      try {
        // Este job corre por REPORTE PROGRAMADO, no por empresa (puede
        // haber varios reportes programados de la misma empresa
        // venciendo el mismo día) — cada corrida se registra igual bajo
        // el `companyId` real del reporte, no una fila "global".
        await runJob('reports.scheduled-reports', scheduledReport.companyId, () =>
          scheduledReportsService.runScheduledReport(scheduledReport.companyId, scheduledReport.id)
        );
      } catch (err) {
        console.error(`Error generando el reporte programado ${scheduledReport.id}:`, err.message);
      }
    }
  });
}

module.exports = { schedule };
