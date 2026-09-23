const cron = require('node-cron');
const prisma = require('../../../core/database/prisma');
const fixedAssetsService = require('./fixed-assets.service');

// Corre el primer día de cada mes a las 3:00 am: deprecia todos los
// activos activos de cada empresa. Los activos por "unidades de
// producción" se saltan automáticamente si nadie registró unidades
// para el periodo (no hay todavía un módulo de producción/uso que las
// reporte solo).
function schedule() {
  cron.schedule('0 3 1 * *', async () => {
    const companies = await prisma.company.findMany({ select: { id: true } });
    for (const company of companies) {
      const admin = await prisma.user.findFirst({ where: { companyId: company.id, role: 'ADMIN' } });
      if (!admin) continue;
      try {
        await fixedAssetsService.runMonthlyDepreciation(company.id, new Date(), admin.id);
      } catch (err) {
        console.error(`Error depreciando activos de la empresa ${company.id}:`, err.message);
      }
    }
  });
}

module.exports = { schedule };
