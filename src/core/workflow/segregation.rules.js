const AppError = require('../utils/AppError');

// Fase 11 (secciones 2 y 11 — "no crear un segundo motor de
// aprobación", "segregación de funciones"): tres módulos distintos
// (Tesorería/Órdenes de Pago, Caja Chica, Inventario/Conteos Físicos)
// habían llegado por su cuenta, en fases separadas, a la MISMA regla
// de negocio — "quien solicita/registra no puede ser quien aprueba" —
// con tres implementaciones casi idénticas y ningún punto compartido.
// Esta función pura es la única fuente de verdad de esa regla: cada
// módulo la sigue llamando desde su propia función `assertCanApprove*`
// (que conserva su firma, sus mensajes y sus códigos de error de
// siempre — cero cambio de comportamiento para quien ya la usa), en
// vez de repetir el `if` a mano una cuarta vez si aparece un caso
// nuevo.
//
// No reemplaza las reglas de NEGOCIO de cada dominio (qué estado debe
// tener el documento, qué rol puede aprobar, cuántos niveles hacen
// falta) — esas siguen viviendo en cada `*.rules.js`, porque son
// distintas en cada uno. Solo centraliza el chequeo universal:
// "el actor que aprueba/ejecuta no puede ser el mismo que solicitó/
// registró".
function assertDifferentActors(requestingUserId, actingUserId, { message, code = 'SELF_APPROVAL_FORBIDDEN' }) {
  if (requestingUserId === actingUserId) {
    throw new AppError(message, 403, code);
  }
}

module.exports = { assertDifferentActors };
