// Mi Cuenta, puntos 8 y 11: historial de auditoría PERSONAL (de solo
// lectura) y su exportación — reutiliza core/audit tal cual, filtrado
// por el propio userId (ver el parámetro nuevo en audit.service.listForCompany).
const auditService = require('../../audit/audit.service');

async function listMyActivity(companyId, userId, { from, to } = {}) {
  return auditService.listForCompany(companyId, { userId, from, to });
}

function csvEscape(value) {
  const str = String(value ?? '');
  return /[,"\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(logs) {
  const header = ['fecha', 'accion', 'tipoDeEntidad', 'idDeEntidad'];
  const rows = logs.map((log) =>
    [log.createdAt.toISOString(), log.action, log.entityType, log.entityId].map(csvEscape).join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

async function exportMyActivity(companyId, userId, format, { from, to } = {}) {
  const logs = await listMyActivity(companyId, userId, { from, to });
  if (format === 'csv') {
    return { content: toCsv(logs), mimeType: 'text/csv', fileExtension: 'csv' };
  }
  return { content: JSON.stringify(logs, null, 2), mimeType: 'application/json', fileExtension: 'json' };
}

module.exports = { listMyActivity, exportMyActivity };
