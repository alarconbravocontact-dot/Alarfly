// Programación de reportes (punto 7, segunda mitad). El envío por
// correo NO está implementado — mismo criterio que
// core/alerts.notifyAlert(): queda como punto de extensión vacío hasta
// que se decida qué proveedor de correo usar. Lo que sí hace esto es
// generar el archivo (reutilizando export.service.js) y dejar
// constancia de cuándo se generó.
const prisma = require('../../../core/database/prisma');
const AppError = require('../../../core/utils/AppError');
const exportService = require('./export.service');

async function createScheduledReport(companyId, userId, data) {
  if (!exportService.REPORT_TYPES.includes(data.reportType)) {
    throw new AppError(`Tipo de reporte no soportado: "${data.reportType}".`, 400, 'UNSUPPORTED_REPORT_TYPE');
  }

  return prisma.scheduledReport.create({
    data: {
      companyId,
      reportType: data.reportType,
      parameters: data.parameters || {},
      frequency: data.frequency,
      recipients: data.recipients,
      createdByUserId: userId,
    },
  });
}

async function listScheduledReports(companyId) {
  return prisma.scheduledReport.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
}

async function updateScheduledReport(companyId, id, changes) {
  const existing = await prisma.scheduledReport.findFirst({ where: { id, companyId } });
  if (!existing) {
    throw new AppError('El reporte programado indicado no existe.', 404, 'SCHEDULED_REPORT_NOT_FOUND');
  }
  return prisma.scheduledReport.update({
    where: { id },
    data: { isActive: changes.isActive, frequency: changes.frequency, recipients: changes.recipients, parameters: changes.parameters },
  });
}

async function deleteScheduledReport(companyId, id) {
  const existing = await prisma.scheduledReport.findFirst({ where: { id, companyId } });
  if (!existing) {
    throw new AppError('El reporte programado indicado no existe.', 404, 'SCHEDULED_REPORT_NOT_FOUND');
  }
  await prisma.scheduledReport.delete({ where: { id } });
}

// Genera el archivo del reporte programado ahora mismo (botón "generar
// ya" o disparado por el cron) y actualiza `lastRunAt`. No envía nada
// todavía — ver nota de arriba.
async function runScheduledReport(companyId, id) {
  const scheduled = await prisma.scheduledReport.findFirst({ where: { id, companyId } });
  if (!scheduled) {
    throw new AppError('El reporte programado indicado no existe.', 404, 'SCHEDULED_REPORT_NOT_FOUND');
  }

  const params = scheduled.parameters || {};
  const format = params.format || 'pdf';
  // `parameters` viaja como JSON en la base de datos: al leerlo de
  // vuelta, from/to/asOfDate son texto plano, no Date — a diferencia
  // de cuando vienen de una petición HTTP normal (ahí Zod ya los
  // convierte con z.coerce.date()). Hay que convertirlos acá antes de
  // pasarlos a un servicio que espera un Date real para filtrar por
  // fecha en Prisma.
  const dateParams = {
    ...params,
    from: params.from ? new Date(params.from) : undefined,
    to: params.to ? new Date(params.to) : undefined,
    asOfDate: params.asOfDate ? new Date(params.asOfDate) : new Date(),
  };
  const result = await exportService.exportReport(companyId, scheduled.reportType, format, dateParams);

  await prisma.scheduledReport.update({ where: { id }, data: { lastRunAt: new Date() } });

  return result;
}

module.exports = { createScheduledReport, listScheduledReports, updateScheduledReport, deleteScheduledReport, runScheduledReport };
