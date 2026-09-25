const cron = require('node-cron');
const prisma = require('../../../core/database/prisma');
const alertsService = require('./alerts.service');
const insightsService = require('../../reports/services/insights.service');
const { runJob } = require('../../../core/jobs/job-run.service');

// Corre todos los días a las 6:00 am: revisa saldo bajo, tarjetas cerca
// del límite y pagos/cuotas próximos a vencer para cada empresa.
//
// Fase 12 (sección 12 — "no crear un cron diferente por cada pequeña
// regla, agrupar responsabilidades coherentemente"): el escaneo de
// riesgo de liquidez (`insightsService.scanLiquidityRisk`, misma
// detección que ya usa la tarjeta de Inicio) se agrupó ACÁ, dentro del
// mismo job diario, en vez de crear un cron nuevo solo para esto — el
// archivo del cron (a diferencia de un servicio de un solo módulo) es
// el punto de composición correcto para juntar Tesorería + Reportes
// sin crear una dependencia circular entre esos dos módulos de
// servicio (ver decisión documentada en PROGRESS_LOG.md, Fase 12).
function schedule() {
  cron.schedule('0 6 * * *', async () => {
    const companies = await prisma.company.findMany({ select: { id: true } });
    for (const company of companies) {
      try {
        await runJob('treasury.alerts-scan', company.id, async () => {
          const [treasuryResult, liquidityRisk] = await Promise.all([
            alertsService.runAlertsScan(company.id),
            insightsService.scanLiquidityRisk(company.id),
          ]);
          return { ...treasuryResult, liquidityRisk };
        });
      } catch (err) {
        console.error(`Error corriendo el escaneo de alertas de la empresa ${company.id}:`, err.message);
      }
    }
  });
}

module.exports = { schedule };
