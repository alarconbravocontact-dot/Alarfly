const cron = require('node-cron');
const prisma = require('../../../core/database/prisma');
const alertsService = require('./alerts.service');

// Corre todos los días a las 6:00 am: revisa saldo bajo, tarjetas cerca
// del límite y pagos/cuotas próximos a vencer para cada empresa.
function schedule() {
  cron.schedule('0 6 * * *', async () => {
    const companies = await prisma.company.findMany({ select: { id: true } });
    for (const company of companies) {
      try {
        await alertsService.runAlertsScan(company.id);
      } catch (err) {
        console.error(`Error corriendo el escaneo de alertas de la empresa ${company.id}:`, err.message);
      }
    }
  });
}

module.exports = { schedule };
