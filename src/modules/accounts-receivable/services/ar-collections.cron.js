const cron = require('node-cron');
const prisma = require('../../../core/database/prisma');
const arCollectionsService = require('./ar-collections.service');
const { runJob } = require('../../../core/jobs/job-run.service');

// Corre todos los días a las 7:00 am (después de Inventario 6:45am,
// mismo criterio de no competir por el mismo momento): revisa facturas
// vencidas y dispara la cobranza escalonada. Atribuye los bloqueos
// automáticos al primer usuario ADMIN de cada empresa, igual que los
// demás jobs automáticos del proyecto.
function schedule() {
  cron.schedule('0 7 * * *', async () => {
    const companies = await prisma.company.findMany({ select: { id: true } });
    for (const company of companies) {
      const admin = await prisma.user.findFirst({ where: { companyId: company.id, role: 'ADMIN' } });
      if (!admin) continue;
      try {
        await runJob('ar.collections-scan', company.id, () => arCollectionsService.scanOverdueInvoices(company.id, admin.id));
      } catch (err) {
        console.error(`Error corriendo la cobranza escalonada de la empresa ${company.id}:`, err.message);
      }
    }
  });
}

module.exports = { schedule };
