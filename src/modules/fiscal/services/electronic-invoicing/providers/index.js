const AppError = require('../../../../../core/utils/AppError');
const mockProvider = require('./mock.provider');

// Registro de adaptadores: agregar un proveedor real es una entrada
// nueva acá, sin cambiar electronic-invoicing.service.js.
const PROVIDERS = { MOCK: mockProvider };

function getProvider(name) {
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new AppError(`Proveedor de facturación electrónica no soportado: "${name}".`, 400, 'UNSUPPORTED_PROVIDER');
  }
  return provider;
}

module.exports = { getProvider };
