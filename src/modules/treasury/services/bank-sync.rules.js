// El proyecto no integra un feed bancario en tiempo real (decisión ya
// documentada en CLAUDE.md) — el "indicador de sincronización" se
// modela honestamente a partir de `StatementImport.createdAt`, la
// última vez que alguien importó un extracto para esa cuenta, en vez
// de simular un estado que no existe. GREEN = importado hace poco,
// YELLOW = empezando a quedar desactualizado, RED = 48h+ sin importar
// (o nunca se importó nada) — el umbral rojo de 48h es el que pidió
// explícitamente el usuario para la alerta automática.
const GREEN_THRESHOLD_HOURS = 24;
const RED_THRESHOLD_HOURS = 48;

function hoursSince(date, now) {
  return (now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60);
}

function computeSyncStatus(lastImportAt, now = new Date()) {
  if (!lastImportAt) return 'RED';
  const hours = hoursSince(lastImportAt, now);
  if (hours < GREEN_THRESHOLD_HOURS) return 'GREEN';
  if (hours < RED_THRESHOLD_HOURS) return 'YELLOW';
  return 'RED';
}

function isDisconnected(lastImportAt, now = new Date()) {
  return computeSyncStatus(lastImportAt, now) === 'RED';
}

module.exports = { computeSyncStatus, isDisconnected, GREEN_THRESHOLD_HOURS, RED_THRESHOLD_HOURS };
