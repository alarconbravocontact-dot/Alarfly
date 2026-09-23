// Bus mínimo (sin dependencias) para avisarle a la barra de progreso
// global cuántas operaciones pesadas siguen en curso ahora mismo.
// Vive fuera de React a propósito: las funciones de `src/api/*.js`
// que descargan un archivo o procesan un lote grande no son
// componentes y no pueden usar un Context — solo necesitan avisar
// "empecé"/"terminé". `GlobalProgressBar` es el único suscriptor.
const listeners = new Set();
let activeCount = 0;

function notify() {
  for (const listener of listeners) listener(activeCount);
}

export function subscribeProgressBar(listener) {
  listeners.add(listener);
  listener(activeCount);
  return () => listeners.delete(listener);
}

// Envuelve una operación pesada real (descargar un PDF/Excel,
// analizar un archivo de importación grande, etc.): suma 1 mientras
// está en curso, resta 1 al terminar (con éxito o con error), nunca
// se queda "pegada" si la operación falla.
export async function withProgress(operation) {
  activeCount += 1;
  notify();
  try {
    return await operation();
  } finally {
    activeCount -= 1;
    notify();
  }
}
