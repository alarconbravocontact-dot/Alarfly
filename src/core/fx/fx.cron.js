const cron = require('node-cron');
const prisma = require('../database/prisma');
const fxService = require('./fx.service');

// Corre el primer día de cada mes a las 2:00 am: revalúa todas las
// cuentas en moneda extranjera de cada empresa. Como es un proceso
// automático (sin un usuario haciendo clic), la autoría del asiento
// queda a nombre del primer usuario ADMIN de cada empresa.
function schedule() {
  cron.schedule('0 2 1 * *', async () => {
    const companies = await prisma.company.findMany({ select: { id: true } });
    for (const company of companies) {
      const admin = await prisma.user.findFirst({ where: { companyId: company.id, role: 'ADMIN' } });
      if (!admin) continue;
      try {
        await fxService.revalueCompany(company.id, new Date(), admin.id);
      } catch (err) {
        console.error(`Error revaluando FX de la empresa ${company.id}:`, err.message);
      }
    }
  });
}

module.exports = { schedule };
