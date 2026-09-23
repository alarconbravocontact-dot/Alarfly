const cron = require('node-cron');
const prisma = require('../../../core/database/prisma');
const scheduledReportsService = require('./scheduled-reports.service');
const { isDue } = require('./scheduled-reports.rules');

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
        await scheduledReportsService.runScheduledReport(scheduledReport.companyId, scheduledReport.id);
      } catch (err) {
        console.error(`Error generando el reporte programado ${scheduledReport.id}:`, err.message);
      }
    }
  });
}

module.exports = { schedule };
