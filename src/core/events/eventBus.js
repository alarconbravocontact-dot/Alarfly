const { EventEmitter } = require('events');

// Bus de eventos interno: los módulos lo usan para avisarse cosas entre
// sí sin depender directamente unos de otros (ver docs/ARQUITECTURA_MAESTRA.md, sección 4b).
const eventBus = new EventEmitter();

module.exports = eventBus;
