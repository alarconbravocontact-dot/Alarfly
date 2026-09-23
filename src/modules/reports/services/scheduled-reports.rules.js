// isDue vivía acá, pero se movió a core/utils/schedulingRules.js porque
// ahora 2 módulos lo necesitan (Reportes y Análisis Avanzados) — regla 1
// de la arquitectura maestra. Este archivo queda como envoltorio
// delgado para no romper ningún import existente dentro de Reportes.
const { isDue } = require('../../../core/utils/schedulingRules');

module.exports = { isDue };
