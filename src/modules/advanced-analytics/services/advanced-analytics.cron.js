const cron = require('node-cron');
const prisma = require('../../../core/database/prisma');
const { runDueAutomations } = require('./automation-runner.service');
const { runJob } = require('../../../core/jobs/job-run.service');

// Corre todos los días a las 7:15am — después de Inventario (6:45am),
// Cobranza de AR y Reportes Programados (ambos 7:00am), mismo criterio
// de no competir por el mismo momento que ya usa el resto de jobs
// automáticos del proyecto. Atribuye la auditoría de cada corrida
// automática al primer usuario ADMIN de cada empresa, igual que los
// demás jobs (no hay todavía un "usuario sistema" dedicado).
function schedule() {
  cron.schedule('15 7 * * *', async () => {
    const companies = await prisma.company.findMany({ select: { id: true } });
    for (const company of companies) {
      const admin = await prisma.user.findFirst({ where: { companyId: company.id, role: 'ADMIN' } });
      if (!admin) continue;
      try {
        await runJob('advanced-analytics.automation', company.id, () => runDueAutomations(company.id, admin.id));
      } catch (err) {
        console.error(`Error corriendo Análisis Avanzados automáticos de la empresa ${company.id}:`, err.message);
      }
    }
  });
}

module.exports = { schedule };
