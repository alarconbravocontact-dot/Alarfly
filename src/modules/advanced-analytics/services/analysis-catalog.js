// Catálogo de los 16 tipos de Análisis Avanzados. Vive en código, no en
// una tabla — mismo patrón que el registro de widgets del Dashboard
// Ejecutivo de Reportes (reports/dashboard.service.js): agregar un
// análisis nuevo el día de mañana es agregar una entrada acá, sin pedir
// una migración de base de datos.
//
// "mode" indica si este análisis REUTILIZA un servicio que ya existe en
// otro módulo (nunca recalcula) o si es NUEVO (construido en este
// módulo). Ver CLAUDE.md para el detalle de qué se reutiliza de dónde.
//
// Categorías usadas para agrupar la pantalla de Catálogo del frontend:
// 'ESTRUCTURA_FINANCIERA' | 'RENTABILIDAD' | 'LIQUIDEZ' | 'RIESGO' |
// 'PROYECCION' | 'COMPARATIVO'

const CATALOG = {
  VERTICAL: {
    label: 'Análisis Vertical',
    category: 'ESTRUCTURA_FINANCIERA',
    defaultChartType: 'COMPOSITION',
    mode: 'NEW',
    simpleDescription:
      'Muestra qué porcentaje representa cada cuenta (ej. Bancos, Inventario, Ventas) sobre el total del Balance o del Estado de Resultados, para ver de un vistazo qué tan grande es cada parte del negocio.',
  },
  HORIZONTAL: {
    label: 'Análisis Horizontal',
    category: 'COMPARATIVO',
    defaultChartType: 'COMPARISON',
    mode: 'REUSE',
    simpleDescription:
      'Compara dos periodos (ej. este mes contra el anterior) cuenta por cuenta, y muestra cuánto subió o bajó cada una en monto y en porcentaje.',
  },
  FINANCIAL_RATIOS: {
    label: 'Razones Financieras',
    category: 'ESTRUCTURA_FINANCIERA',
    defaultChartType: 'COMPARISON',
    mode: 'NEW',
    simpleDescription:
      'Calcula los indicadores clásicos de salud financiera (liquidez, solvencia, rentabilidad, actividad y valuación) y los compara contra el periodo anterior.',
  },
  CASH_FLOW: {
    label: 'Flujo de Efectivo',
    category: 'LIQUIDEZ',
    defaultChartType: 'TREND_LINE',
    mode: 'REUSE',
    simpleDescription:
      'Muestra de dónde entró y hacia dónde salió el dinero: de operar el negocio, de invertir, o de financiarse (préstamos/capital).',
  },
  BREAK_EVEN: {
    label: 'Punto de Equilibrio',
    category: 'RENTABILIDAD',
    defaultChartType: 'TREND_LINE',
    mode: 'NEW',
    simpleDescription:
      'Calcula cuánto tienes que vender para no perder ni ganar dinero — el punto exacto donde tus ingresos cubren todos tus costos.',
  },
  CVU: {
    label: 'Costo-Volumen-Utilidad',
    category: 'RENTABILIDAD',
    defaultChartType: 'TREND_LINE',
    mode: 'NEW',
    simpleDescription:
      'Extiende el Punto de Equilibrio: muestra cuánto ganarías (o perderías) en distintos niveles de venta, no solo en el punto exacto de equilibrio.',
  },
  WORKING_CAPITAL: {
    label: 'Capital de Trabajo',
    category: 'LIQUIDEZ',
    defaultChartType: 'COMPOSITION',
    mode: 'NEW',
    simpleDescription:
      'Mide si tienes suficiente dinero "a la mano" (efectivo, cuentas por cobrar, inventario) para cubrir tus deudas de corto plazo, y qué tan rápido se mueve ese dinero.',
  },
  PROFITABILITY_SEGMENT: {
    label: 'Rentabilidad por Producto/Cliente',
    category: 'RENTABILIDAD',
    defaultChartType: 'COMPOSITION',
    mode: 'REUSE',
    simpleDescription: 'Muestra qué productos o clientes te dejan más ganancia y cuáles te están costando dinero.',
  },
  BUDGET_VS_ACTUAL: {
    label: 'Presupuesto vs. Real',
    category: 'COMPARATIVO',
    defaultChartType: 'COMPARISON',
    mode: 'REUSE',
    simpleDescription: 'Compara lo que planeaste gastar o ganar contra lo que realmente pasó, cuenta por cuenta.',
  },
  DUPONT: {
    label: 'Análisis DuPont',
    category: 'RENTABILIDAD',
    defaultChartType: 'COMPOSITION',
    mode: 'NEW',
    simpleDescription:
      'Descompone la rentabilidad de la empresa (ROE) en 3 causas concretas: qué tan bien vendes, qué tan bien usas tus activos, y cuánta deuda usas.',
  },
  TREND_ANALYSIS: {
    label: 'Análisis de Tendencias',
    category: 'COMPARATIVO',
    defaultChartType: 'TREND_LINE',
    mode: 'NEW',
    simpleDescription: 'Muestra cómo se movió una métrica clave (ventas, gastos, utilidad) mes a mes en el tiempo.',
  },
  WHAT_IF_SCENARIO: {
    label: 'Simulador de Escenarios (What-If)',
    category: 'PROYECCION',
    defaultChartType: 'COMPARISON',
    mode: 'REUSE',
    simpleDescription: 'Simula qué pasaría con tu negocio si cambias algo (ej. subes ventas 10%, contratas a alguien nuevo).',
  },
  INVESTMENT_EVALUATION: {
    label: 'Evaluación de Inversiones',
    category: 'PROYECCION',
    defaultChartType: 'TREND_LINE',
    mode: 'NEW',
    simpleDescription:
      'Calcula si vale la pena una inversión (comprar equipo, abrir una sucursal): cuánto te devuelve, y en cuánto tiempo recuperas lo invertido.',
  },
  FINANCIAL_RISK_LEVERAGE: {
    label: 'Riesgo Financiero y Apalancamiento',
    category: 'RIESGO',
    defaultChartType: 'COMPOSITION',
    mode: 'NEW',
    simpleDescription:
      'Mide qué tan expuesta está tu empresa: a tener que pagar deuda cara, a que suba una tasa de interés, o a que cambie el valor del dólar.',
  },
  BENCHMARKING: {
    label: 'Benchmarking contra la Industria',
    category: 'COMPARATIVO',
    defaultChartType: 'COMPARISON',
    mode: 'NEW',
    simpleDescription: 'Compara tus indicadores contra un valor de referencia del sector que tú mismo configuras.',
  },
  PREDICTIVE_FORECAST: {
    label: 'Análisis Predictivo / Proyecciones',
    category: 'PROYECCION',
    defaultChartType: 'TREND_LINE',
    mode: 'NEW',
    simpleDescription: 'Proyecta cómo se vería tu caja en las próximas semanas si todo sigue la tendencia actual.',
  },
};

function listCatalog() {
  return Object.entries(CATALOG).map(([analysisType, entry]) => ({ analysisType, ...entry }));
}

function getCatalogEntry(analysisType) {
  const entry = CATALOG[analysisType];
  if (!entry) return null;
  return { analysisType, ...entry };
}

module.exports = { CATALOG, listCatalog, getCatalogEntry };
