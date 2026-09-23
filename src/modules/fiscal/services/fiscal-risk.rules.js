// El evaluador seguro de condiciones vivía acá, pero se movió a
// core/utils/conditionEvaluator.js porque ahora 2 módulos lo necesitan
// (Fiscal y Análisis Avanzados) — regla 1 de la arquitectura maestra.
// Este archivo queda como envoltorio delgado para no romper ningún
// import existente dentro de Fiscal.
const { evaluateCondition } = require('../../../core/utils/conditionEvaluator');

module.exports = { evaluateCondition };
