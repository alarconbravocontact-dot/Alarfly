// Envuelve un controlador async para que cualquier error caído
// (throw o promesa rechazada) llegue al manejador de errores central
// en vez de colgar la petición.
const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
