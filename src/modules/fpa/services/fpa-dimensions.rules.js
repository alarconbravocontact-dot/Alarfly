const AppError = require('../../../core/utils/AppError');

// Función pura (sin base de datos): evita que una dimensión termine
// siendo su propio ancestro al asignarle un padre (ciclo en la
// jerarquía). `allDimensions` es la lista completa de la empresa, ya
// consultada, con forma { id, parentId }.
function assertNoCycle(dimensionId, newParentId, allDimensions) {
  if (!newParentId) return;

  if (newParentId === dimensionId) {
    throw new AppError('Una dimensión no puede ser su propia dimensión padre.', 400, 'INVALID_PARENT_DIMENSION');
  }

  const byId = new Map(allDimensions.map((d) => [d.id, d]));
  let ancestor = byId.get(newParentId);

  while (ancestor?.parentId) {
    if (ancestor.parentId === dimensionId) {
      throw new AppError(
        'Esa relación crearía un ciclo en la jerarquía de dimensiones.',
        400,
        'CIRCULAR_DIMENSION_HIERARCHY'
      );
    }
    ancestor = byId.get(ancestor.parentId);
  }
}

module.exports = { assertNoCycle };
