const AppError = require('../utils/AppError');

// Manejador de errores central: convierte cualquier error en una
// respuesta clara. Los servicios lanzan AppError con su propio mensaje;
// todo lo demás se trata como error inesperado (500) sin filtrar detalles
// internos al usuario.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: { message: err.message, code: err.code } });
  }

  // Restricción de base de datos (ej: intentar borrar una cuenta con
  // movimientos, que está protegida con onDelete: Restrict).
  if (err.code === 'P2003') {
    return res.status(409).json({
      error: {
        message: 'No se puede completar la acción porque hay datos relacionados que dependen de esto.',
        code: 'RELATED_DATA_EXISTS',
      },
    });
  }

  console.error(err);
  return res.status(500).json({
    error: { message: 'Ocurrió un error inesperado. Intenta de nuevo.', code: 'INTERNAL_ERROR' },
  });
}

module.exports = errorHandler;
