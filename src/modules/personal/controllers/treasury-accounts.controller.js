// Bug real encontrado con Playwright: Financiero (FINANCE) entra al
// módulo Personal, pero el gate de Tesorería (`treasury:
// ['ADMIN','COLLABORATOR']`) nunca lo deja pasar — así que no podía
// ver la lista de cuentas de tesorería para "Registrar pago"/
// "Reembolsar" (sección 11: "El usuario debe poder seleccionar el
// método disponible"), aunque sí tenga permiso real para pagar/
// reembolsar dentro de Personal. Se agrega este pase de solo lectura,
// gateado por el propio módulo Personal (no por el de Tesorería),
// que reutiliza DIRECTAMENTE el servicio de Tesorería ya existente —
// nunca se duplica la consulta ni se amplía el acceso real a
// Tesorería (el resto de endpoints de ese módulo siguen vedados).
const asyncHandler = require('../../../core/utils/asyncHandler');
const treasuryAccountsService = require('../../treasury/services/treasury-accounts.service');

const list = asyncHandler(async (req, res) => {
  const accounts = await treasuryAccountsService.listTreasuryAccounts(req.auth.companyId, { isActive: true });
  res.json(accounts);
});

module.exports = { list };
