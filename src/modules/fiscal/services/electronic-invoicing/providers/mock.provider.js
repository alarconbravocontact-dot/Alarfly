const crypto = require('crypto');

// Adaptador de prueba: simula lo que haría un proveedor real de
// facturación electrónica (DIAN, SAT, etc.) sin llamar a ningún
// servicio externo. Conectar un proveedor real es agregar un archivo
// nuevo aquí con la misma forma — generate(fiscalTransaction) ->
// { status, externalDocumentId, validationCode, errorMessage,
// responsePayload } — y registrarlo en providers/index.js, sin tocar
// el resto del módulo.
function generate(fiscalTransaction) {
  // Simula que el proveedor rechaza un comprobante sin NIT/RFC del
  // receptor (así se puede probar el camino de rechazo sin depender
  // de una API real).
  if (!fiscalTransaction.counterpartyTaxId || fiscalTransaction.counterpartyTaxId.trim() === '') {
    return {
      status: 'REJECTED',
      externalDocumentId: null,
      validationCode: null,
      errorMessage: 'El proveedor rechazó el comprobante: falta el NIT/RFC del receptor.',
      responsePayload: { simulated: true, reason: 'MISSING_TAX_ID' },
    };
  }

  const externalDocumentId = `MOCK-${fiscalTransaction.id.slice(-8).toUpperCase()}`;
  const validationCode = crypto.randomBytes(16).toString('hex');

  return {
    status: 'GENERATED',
    externalDocumentId,
    validationCode,
    errorMessage: null,
    responsePayload: { simulated: true, generatedAt: new Date().toISOString() },
  };
}

module.exports = { generate };
