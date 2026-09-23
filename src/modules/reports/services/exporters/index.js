// Movido a core/utils/exporters porque ahora 2+ módulos lo necesitan
// (Reportes y el componente de tabla reutilizable de
// core/table-preferences) — regla 1 de la arquitectura maestra. Este
// archivo queda como envoltorio delgado para no romper los imports
// existentes.
module.exports = require('../../../../core/utils/exporters');
