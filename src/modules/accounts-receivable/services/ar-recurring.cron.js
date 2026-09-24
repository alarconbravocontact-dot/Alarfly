const cron = require('node-cron');
const prisma = require('../../../core/database/prisma');
const arRecurringService = require('./ar-recurring.service');
const { runJob } = require('../../../core/jobs/job-run.service');

// Corre todos los días a las 7:10 am (después de la cobranza escalonada
// de las 7:00am, mismo criterio de no competir por el mismo momento):
// revisa las plantillas de recurrencia activas de cada empresa y
// genera la factura de las que ya les toca (isDue, siempre MONTHLY).
function schedule() {
  cron.schedule('10 7 * * *', async () => {
    const companies = await prisma.company.findMany({ select: { id: true } });
    for (const company of companies) {
      try {
        await runJob('ar.recurring-invoices', company.id, () => arRecurringService.runDueTemplates(company.id));
      } catch (err) {
        console.error(`Error generando facturas recurrentes de la empresa ${company.id}:`, err.message);
      }
    }
  });
}

module.exports = { schedule };
