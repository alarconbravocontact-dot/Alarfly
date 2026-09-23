const cron = require('node-cron');
const prisma = require('../../../core/database/prisma');
const inventoryAlertsService = require('./inventory-alerts.service');

// Corre todos los días a las 6:45 am (después de Tesorería 6:00am y
// Fiscal 6:30am, mismo criterio de no competir por el mismo momento):
// revisa stock bajo (genera orden de compra borrador) y lotes por
// vencer. Atribuye las órdenes de compra automáticas al primer
// usuario ADMIN de cada empresa, igual que los demás jobs automáticos
// (no hay todavía un "usuario sistema" dedicado).
function schedule() {
  cron.schedule('45 6 * * *', async () => {
    const companies = await prisma.company.findMany({ select: { id: true } });
    for (const company of companies) {
      const admin = await prisma.user.findFirst({ where: { companyId: company.id, role: 'ADMIN' } });
      if (!admin) continue;
      try {
        await inventoryAlertsService.runInventoryAlertsScan(company.id, admin.id);
      } catch (err) {
        console.error(`Error corriendo el escaneo de alertas de inventario de la empresa ${company.id}:`, err.message);
      }
    }
  });
}

module.exports = { schedule };
