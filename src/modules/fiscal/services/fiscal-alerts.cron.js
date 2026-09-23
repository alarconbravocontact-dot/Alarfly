const cron = require('node-cron');
const prisma = require('../../../core/database/prisma');
const fiscalAlertsService = require('./fiscal-alerts.service');

// Corre todos los días a las 6:30 am (media hora después del escaneo
// de alertas de Tesorería, para no competir por el mismo momento):
// revisa qué obligaciones fiscales están por vencer.
function schedule() {
  cron.schedule('30 6 * * *', async () => {
    const companies = await prisma.company.findMany({ select: { id: true } });
    for (const company of companies) {
      try {
        await fiscalAlertsService.scanFiscalObligations(company.id);
      } catch (err) {
        console.error(`Error corriendo el escaneo de obligaciones fiscales de la empresa ${company.id}:`, err.message);
      }
    }
  });
}

module.exports = { schedule };
