// Error de negocio con mensaje claro para el usuario y código HTTP asociado.
// Los servicios lanzan esto en vez de errores genéricos, así el
// manejador de errores sabe cómo responder sin adivinar.
class AppError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

module.exports = AppError;
