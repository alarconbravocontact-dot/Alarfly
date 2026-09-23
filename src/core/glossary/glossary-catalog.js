// Glosario central de términos financieros/contables (tooltips
// educativos): vive en código, no en una tabla — mismo criterio que el
// catálogo de los 16 análisis de Análisis Avanzados, agregar un
// término nuevo es una entrada más acá, no una migración.
// `hasLiveValue: true` marca los términos que además de la definición
// genérica pueden mostrar el valor REAL y actual de la empresa que
// está mirando la pantalla (ver glossary.service.getLiveValue) — la
// innovación pedida explícitamente por el usuario.
const TERMS = [
  {
    key: 'ebitda',
    label: 'EBITDA',
    definition:
      'La utilidad que deja el negocio antes de intereses, impuestos, depreciación y amortización — mide qué tan bien genera dinero la operación normal, sin el efecto de préstamos ni de cómo se contabilizan los activos.',
    hasLiveValue: true,
  },
  {
    key: 'burn-rate',
    label: 'Burn rate',
    definition: 'Cuánto dinero está perdiendo el negocio, en promedio, cada mes. En 0 si el negocio no está perdiendo dinero.',
    hasLiveValue: true,
  },
  {
    key: 'runway',
    label: 'Runway',
    definition: 'Cuántos meses más puede seguir operando el negocio al ritmo actual de gasto, antes de quedarse sin caja.',
    hasLiveValue: true,
  },
  {
    key: 'liquidity-cushion',
    label: 'Colchón de liquidez',
    definition: 'El dinero disponible de inmediato para pagar compromisos: la caja actual más las líneas de crédito ya aprobadas y sin usar.',
    hasLiveValue: true,
  },
  {
    key: 'accounts-receivable',
    label: 'Cuentas por cobrar',
    definition: 'El total que los clientes todavía te deben por facturas ya emitidas y no pagadas.',
    hasLiveValue: true,
  },
  {
    key: 'accounts-payable',
    label: 'Cuentas por pagar',
    definition: 'El total que tú le debes a tus proveedores por facturas de compra ya recibidas y no pagadas.',
    hasLiveValue: true,
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
