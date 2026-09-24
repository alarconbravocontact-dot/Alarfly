// Catálogo de los jobs automáticos (cron) del proyecto — código, no
// tabla, mismo patrón ya usado por el catálogo de los 16 análisis
// (advanced-analytics) o el glosario (core/glossary): agregar un job
// nuevo es una entrada más acá, nunca una migración. `jobKey` es el
// identificador estable que cada cron pasa a `jobRunService.recordRun`
// — si un cron nuevo usa una clave que no está en este registro, sigue
// funcionando (el registro es solo para presentación/catálogo), pero
// no aparecerá en el catálogo de "Trabajos automáticos" hasta que se
// agregue acá.
//
// `scheduleLabel`: texto simple en español, la misma frase que ya
// llevaba el comentario de cada archivo `*.cron.js` — no se agregó una
// librería de parseo de expresiones cron (`cron-parser` u otra) solo
// para calcular la "próxima ejecución" exacta; con 9 jobs diarios/
// mensuales a horas fijas, un texto legible es suficiente y no arrastra
// una dependencia nueva. Documentado como límite consciente (Fase 11).
const JOB_DEFINITIONS = [
  {
    key: 'fx.monthly-revaluation',
    label: 'Revaluación cambiaria mensual',
    module: 'Contabilidad (core/fx)',
    scheduleLabel: 'El día 1 de cada mes, 2:00 am',
  },
  {
    key: 'accounting.monthly-depreciation',
    label: 'Depreciación mensual de activos fijos',
    module: 'Contabilidad',
    scheduleLabel: 'El día 1 de cada mes, 3:00 am',
  },
  {
    key: 'treasury.alerts-scan',
    label: 'Escaneo de alertas de Tesorería',
    module: 'Tesorería',
    scheduleLabel: 'Todos los días, 6:00 am',
  },
  {
    key: 'fiscal.obligations-scan',
    label: 'Escaneo de obligaciones fiscales',
    module: 'Fiscal',
    scheduleLabel: 'Todos los días, 6:30 am',
  },
  {
    key: 'inventory.alerts-scan',
    label: 'Escaneo de stock bajo y vencimientos',
    module: 'Inventario',
    scheduleLabel: 'Todos los días, 6:45 am',
  },
  {
    key: 'ar.collections-scan',
    label: 'Cobranza escalonada de AR',
    module: 'Cuentas por Cobrar',
    scheduleLabel: 'Todos los días, 7:00 am',
  },
  {
    key: 'reports.scheduled-reports',
    label: 'Generación de reportes programados',
    module: 'Reportes',
    scheduleLabel: 'Todos los días, 7:00 am',
  },
  {
    key: 'ar.recurring-invoices',
    label: 'Facturas recurrentes de AR',
    module: 'Cuentas por Cobrar',
    scheduleLabel: 'Todos los días, 7:10 am',
  },
  {
    key: 'advanced-analytics.automation',
    label: 'Análisis avanzados automáticos',
    module: 'Análisis Avanzados',
    scheduleLabel: 'Todos los días, 7:15 am',
  },
];

function listJobDefinitions() {
  return JOB_DEFINITIONS;
}

module.exports = { JOB_DEFINITIONS, listJobDefinitions };
