// F15-E8: sin esto, un error reportado por un usuario ("me dio un
// error a las 3pm") no se podía correlacionar con ninguna línea
// concreta del log del servidor — el log de morgan y el `console.error`
// del manejador de errores no compartían ningún identificador en
// común. Cada petición recibe un id propio (no una dependencia nueva,
// `crypto.randomUUID()` ya es nativo de Node), expuesto también en la
// respuesta (`X-Request-Id`) para que el frontend pueda mostrarlo si
// alguna vez hace falta reportar un error puntual.
const crypto = require('crypto');

function requestId(req, res, next) {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

module.exports = requestId;
