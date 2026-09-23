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

  // Fase 2 (maestros): violación de una restricción única (ej. crear un
  // cliente/proveedor/producto/categoría/unidad de medida con un nombre
  // o código que ya existe en la empresa). Antes de esto no había un
  // manejo genérico — cada servicio tenía que traducirlo a mano (como
  // ya hacía `customers.service.importCustomers`), y cualquier otro
  // camino que no lo hiciera dejaba pasar el error crudo de Prisma
  // hacia el manejador genérico de 500 ("error inesperado"), en vez de
  // un 409 claro. Genérico a propósito: sirve por igual para los 5
  // maestros (y cualquier otro modelo con restricción única) sin
  // duplicar esta traducción servicio por servicio.
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: {
        message: 'Ya existe un registro con ese mismo valor. Revisa el dato e intenta con uno distinto.',
        code: 'DUPLICATE_VALUE',
      },
    });
  }

  console.error(err);
  return res.status(500).json({
    error: { message: 'Ocurrió un error inesperado. Intenta de nuevo.', code: 'INTERNAL_ERROR' },
  });
}

module.exports = errorHandler;
