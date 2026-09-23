// Selector unificado de idioma/huso horario/formato regional (Feature
// U): lista curada de husos horarios comunes para una empresa
// hispanohablante — no la lista completa de la IANA TZ database (más
// de 400 entradas, abrumadora en un select). Compartida entre el
// perfil de la empresa (Mi Cuenta > Perfil) y las preferencias
// personales (Mi Cuenta > Preferencias) para no duplicar la lista.
export const TIMEZONE_OPTIONS = [
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Caracas',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Sao_Paulo',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Madrid',
  'UTC',
];

// Si el huso detectado (ej. el del navegador) no está en la lista
// curada, se agrega dinámicamente al principio en vez de perderlo.
export function buildTimeZoneOptions(detected) {
  return detected && !TIMEZONE_OPTIONS.includes(detected) ? [detected, ...TIMEZONE_OPTIONS] : TIMEZONE_OPTIONS;
}
