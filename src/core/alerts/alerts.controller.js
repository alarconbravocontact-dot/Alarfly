// Centro de Notificaciones: envoltura delgada de solo lectura + atender
// sobre el motor de alertas ya existente — no gate de módulo porque las
// alertas ya abarcan varios módulos (Tesorería, Fiscal, Inventario, AR,
// Análisis Avanzados) y cada usuario debe poder ver las suyas sin
// importar a qué módulos tiene acceso.
const asyncHandler = require('../utils/asyncHandler');
const alertsService = require('./alerts.service');

const list = asyncHandler(async (req, res) => {
  const alerts = await alertsService.listAlertsForUser(req.auth.companyId, req.auth.userId, req.query);
  res.json(alerts);
});

const acknowledge = asyncHandler(async (req, res) => {
  const alert = await alertsService.acknowledgeAlert(req.auth.companyId, req.params.id, req.auth.userId);
  res.json(alert);
});

module.exports = { list, acknowledge };
