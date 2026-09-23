// Capa de presentación sobre la consolidación multi-empresa que ya
// existe en Contabilidad (punto 5): esta función NUNCA recalcula la
// consolidación, solo la expone bajo /reports. El detalle de
// eliminaciones (`eliminatedDetail`) se agregó directamente en
// accounting/consolidation.service.getConsolidatedTrialBalance (una
// mejora aditiva, no una duplicación) porque ya tenía toda la
// información — solo le faltaba devolver el detalle además del total.
const consolidationService = require('../../accounting/services/consolidation.service');

async function getConsolidatedTrialBalance(parentCompanyId, asOfDate) {
  return consolidationService.getConsolidatedTrialBalance(parentCompanyId, asOfDate);
}

module.exports = { getConsolidatedTrialBalance };
