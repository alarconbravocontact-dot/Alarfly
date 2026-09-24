// Glosario central de términos financieros/contables (tooltips
// educativos): vive en código, no en una tabla — mismo criterio que el
// catálogo de los 16 análisis de Análisis Avanzados, agregar un
// término nuevo es una entrada más acá, no una migración.
// `hasLiveValue: true` marca los términos que además de la definición
// genérica pueden mostrar el valor REAL y actual de la empresa que
// está mirando la pantalla (ver glossary.service.getLiveValue) — la
// innovación pedida explícitamente por el usuario.
//
// Fase 8 (sección 8, catálogo de KPIs): los términos con valor en vivo
// ganaron `formula`/`sourceRef`/`unit`/`periodicity`/`dimensions` — la
// metadata que pide un catálogo de KPIs reproducible (sección 10:
// "¿con qué fórmula? ¿con qué datos?"). No se creó ningún catálogo
// nuevo ni una tabla nueva: este glosario, que ya resolvía el valor en
// vivo de estos mismos 6 términos reutilizando `finance-summary`/
// `fpa/kpisService` (nunca recalculando), ya era la pieza más cercana
// a un catálogo de KPIs que existía — se completó con los campos que
// le faltaban en vez de construir una segunda estructura paralela
// (`core/analytics`, evaluado y descartado por falta de necesidad
// demostrada, ver PROGRESS_LOG). `sourceRef` es una referencia de
// código literal (archivo#función), no una URL ni un endpoint — sirve
// para que cualquiera pueda ir directo a la función real que calculó
// el número, sin adivinar.
const TERMS = [
  {
    key: 'ebitda',
    label: 'EBITDA',
    definition:
      'La utilidad que deja el negocio antes de intereses, impuestos, depreciación y amortización — mide qué tan bien genera dinero la operación normal, sin el efecto de préstamos ni de cómo se contabilizan los activos.',
    hasLiveValue: true,
    formula: 'Utilidad Neta + Intereses + Depreciación/Amortización (sin Impuestos — Fiscal todavía no se resta acá)',
    sourceRef: 'src/modules/fpa/services/kpis.service.js#getEbitda',
    unit: 'currency',
    periodicity: 'monthly',
    dimensions: ['companyId', 'period'],
  },
  {
    key: 'burn-rate',
    label: 'Burn rate',
    definition: 'Cuánto dinero está perdiendo el negocio, en promedio, cada mes. En 0 si el negocio no está perdiendo dinero.',
    hasLiveValue: true,
    formula: 'Promedio mensual de pérdida neta (0 si la utilidad del periodo es positiva)',
    sourceRef: 'src/modules/fpa/services/kpis.service.js#getBurnRateAndRunway',
    unit: 'currency',
    periodicity: 'monthly',
    dimensions: ['companyId', 'period'],
  },
  {
    key: 'runway',
    label: 'Runway',
    definition: 'Cuántos meses más puede seguir operando el negocio al ritmo actual de gasto, antes de quedarse sin caja.',
    hasLiveValue: true,
    formula: 'Colchón de liquidez ÷ Burn rate (sin definir si no se está quemando caja)',
    sourceRef: 'src/modules/fpa/services/kpis.service.js#getBurnRateAndRunway',
    unit: 'months',
    periodicity: 'monthly',
    dimensions: ['companyId', 'period'],
  },
  {
    key: 'liquidity-cushion',
    label: 'Colchón de liquidez',
    definition: 'El dinero disponible de inmediato para pagar compromisos: la caja actual más las líneas de crédito ya aprobadas y sin usar.',
    hasLiveValue: true,
    formula: 'Posición de caja consolidada (todas las cuentas, convertidas a moneda base) + cupo disponible de líneas de crédito activas',
    sourceRef: 'src/modules/finance/services/finance-summary.service.js#getFinanceSummary',
    unit: 'currency',
    periodicity: 'instant',
    dimensions: ['companyId', 'asOfDate'],
  },
  {
    key: 'accounts-receivable',
    label: 'Cuentas por cobrar',
    definition: 'El total que los clientes todavía te deben por facturas ya emitidas y no pagadas.',
    hasLiveValue: true,
    formula: 'Suma de (Total − Cobrado) de las facturas de venta abiertas o parcialmente cobradas (calculado por reports/aging.service, leído acá a través de la capa de lectura consolidada de Finanzas)',
    sourceRef: 'src/modules/finance/services/finance-summary.service.js#getFinanceSummary',
    unit: 'currency',
    periodicity: 'instant',
    dimensions: ['companyId', 'asOfDate'],
  },
  {
    key: 'accounts-payable',
    label: 'Cuentas por pagar',
    definition: 'El total que tú le debes a tus proveedores por facturas de compra ya recibidas y no pagadas.',
    hasLiveValue: true,
    formula: 'Suma de (Total − Pagado) de las facturas de compra abiertas o parcialmente pagadas (calculado por reports/aging.service, leído acá a través de la capa de lectura consolidada de Finanzas)',
    sourceRef: 'src/modules/finance/services/finance-summary.service.js#getFinanceSummary',
    unit: 'currency',
    periodicity: 'instant',
    dimensions: ['companyId', 'asOfDate'],
  },
  {
    key: 'sales-this-month',
    label: 'Ventas de este mes',
    definition: 'El total facturado a clientes en lo que va del mes, sin importar si ya se cobró o no.',
    hasLiveValue: true,
    formula: 'Suma del total facturado (subtotal + impuesto) de las facturas de venta emitidas en el mes en curso',
    sourceRef: 'src/modules/accounts-receivable/services/ar-invoices.service.js#getSalesTrend',
    unit: 'currency',
    periodicity: 'monthly',
    dimensions: ['companyId', 'period'],
  },
  {
    key: 'double-entry',
    label: 'Partida doble',
    definition:
      'La regla base de la contabilidad: todo movimiento de dinero se registra dos veces — de dónde sale y a dónde entra — y ambos lados siempre deben sumar lo mismo.',
    hasLiveValue: false,
  },
  {
    key: 'journal-entry',
    label: 'Asiento contable',
    definition: 'El registro formal de un movimiento de dinero u obligación, con al menos una cuenta que recibe y otra que entrega.',
    hasLiveValue: false,
  },
  {
    key: 'depreciation',
    label: 'Depreciación',
    definition: 'Cómo se reparte el costo de un activo (ej. un vehículo o una computadora) a lo largo de los años que se espera usarlo.',
    hasLiveValue: false,
  },
  {
    key: 'bank-reconciliation',
    label: 'Conciliación bancaria',
    definition: 'Comparar lo que dice el banco contra lo que tienes registrado, para confirmar que coincide o encontrar diferencias.',
    hasLiveValue: false,
  },
  {
    key: 'trial-balance',
    label: 'Balance de comprobación',
    definition: 'Un listado de todas las cuentas con su saldo a una fecha, usado para confirmar que la contabilidad está cuadrada antes de armar los estados financieros.',
    hasLiveValue: false,
  },
  {
    key: 'working-capital',
    label: 'Capital de trabajo',
    definition: 'El dinero disponible para operar el día a día: lo que se puede convertir en efectivo pronto, menos lo que hay que pagar pronto.',
    hasLiveValue: false,
  },
];

const TERMS_BY_KEY = new Map(TERMS.map((t) => [t.key, t]));

module.exports = { TERMS, TERMS_BY_KEY };
