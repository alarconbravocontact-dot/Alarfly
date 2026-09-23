// Catálogo de artículos de ayuda contextual — código, no tabla, mismo
// criterio que `core/glossary/glossary-catalog.js` y el catálogo de
// los 16 análisis de Análisis Avanzados: agregar un artículo nuevo es
// una entrada más en este archivo, no una migración. Cada artículo se
// etiqueta con los `moduleKeys` (los mismos strings que ya usa
// `core/rbac/module-access.js`) donde debe aparecer en el botón de
// ayuda contextual.
const HELP_ARTICLES = [
  {
    id: 'dashboard-kpis',
    title: '¿Qué significan los números del Panel principal?',
    body: 'La Posición de caja consolidada suma el saldo de todas tus cuentas bancarias convertido a la moneda de tu empresa. El EBITDA, Burn rate y Runway se explican con más detalle si tocas cada palabra — tienen su propio ícono de ayuda "?" al lado.',
    moduleKeys: ['dashboard'],
  },
  {
    id: 'dashboard-setup',
    title: '¿Por qué veo una barra de progreso arriba de todo?',
    body: 'Es la guía de configuración inicial. Marca automáticamente cada paso como hecho apenas detecta que ya lo hiciste (ej. cargar tu RIF, tu primera cuenta bancaria) — no hay que apretar ningún botón de "listo".',
    moduleKeys: ['dashboard'],
  },
  {
    id: 'accounting-chart',
    title: '¿Cómo organizo mi Plan de Cuentas?',
    body: 'Cada cuenta puede tener cuentas hijas debajo (ej. "Bancos" con "Banco Principal" adentro). Una cuenta con hijas deja de admitir movimientos directos automáticamente — solo las cuentas "de más abajo" reciben asientos.',
    moduleKeys: ['accounting'],
  },
  {
    id: 'accounting-entry-balance',
    title: '¿Por qué no me deja guardar un asiento contable?',
    body: 'Un asiento contable siempre debe "cuadrar": la suma de todos los débitos tiene que ser exactamente igual a la suma de todos los créditos. El formulario te muestra la diferencia en vivo mientras escribes las líneas.',
    moduleKeys: ['accounting'],
  },
  {
    id: 'treasury-reconciliation',
    title: '¿Qué es conciliar un movimiento bancario?',
    body: 'Es confirmar que un movimiento que aparece en tu extracto bancario corresponde a un asiento contable real que ya registraste (o generar uno nuevo si nunca se registró). El sistema intenta emparejar automáticamente por monto y fecha, y te deja resolver a mano los que no está seguro.',
    moduleKeys: ['treasury'],
  },
  {
    id: 'treasury-payment-approval',
    title: '¿Por qué no puedo aprobar mi propia orden de pago?',
    body: 'Es una regla de seguridad (maker-checker): quien crea una orden de pago nunca puede ser quien la aprueba, sin importar su rol. Necesita que otro usuario con permiso la revise y confirme.',
    moduleKeys: ['treasury'],
  },
  {
    id: 'ar-credit-limit',
    title: '¿Por qué el sistema bloqueó una factura a un cliente?',
    body: 'Cada cliente puede tener un límite de crédito configurado. Si la nueva factura haría que el cliente deba más de ese límite (o si tiene facturas muy atrasadas), el sistema no deja facturar hasta que se cobre algo o se ajuste el límite.',
    moduleKeys: ['accounts-receivable', 'accounts-payable'],
  },
  {
    id: 'ar-collections',
    title: '¿Cómo funciona la cobranza automática?',
    body: 'El sistema revisa todos los días qué facturas están vencidas. Según cuántos días de atraso lleven, manda un recordatorio, después un aviso más firme, y si el atraso es grave bloquea automáticamente al cliente para que no se le pueda facturar más hasta que pague.',
    moduleKeys: ['accounts-receivable'],
  },
  {
    id: 'inventory-valuation',
    title: '¿Qué diferencia hay entre FIFO, LIFO y Promedio Ponderado?',
    body: 'Son formas de calcular cuánto costó lo que vendiste cuando compraste el mismo producto varias veces a precios distintos. FIFO usa primero el costo de lo más viejo, LIFO usa primero el costo de lo más nuevo, y Promedio Ponderado mezcla todos los costos en uno solo.',
    moduleKeys: ['inventory'],
  },
  {
    id: 'inventory-low-stock',
    title: '¿Cómo se generan las órdenes de compra automáticas?',
    body: 'Cada producto puede tener un stock mínimo configurado. Cuando el stock de un almacén baja de ese mínimo, el sistema arma solo una orden de compra en borrador hacia el proveedor preferido de ese producto, lista para revisar y enviar.',
    moduleKeys: ['inventory'],
  },
  {
    id: 'fiscal-electronic-invoicing',
    title: '¿Por qué se rechazó un comprobante electrónico?',
    body: 'El proveedor de facturación electrónica (hoy un adaptador de prueba) rechaza un comprobante si le falta un dato obligatorio del receptor, como su NIT o RFC. Completa ese dato en el cliente o proveedor y vuelve a intentar.',
    moduleKeys: ['fiscal'],
  },
  {
    id: 'fiscal-risk-rules',
    title: '¿Qué diferencia hay entre una regla de riesgo bloqueante y una de advertencia?',
    body: 'Una regla bloqueante impide crear la transacción fiscal por completo. Una de advertencia sí la deja crear, pero deja una alerta visible para que alguien la revise después.',
    moduleKeys: ['fiscal'],
  },
  {
    id: 'fpa-budget-versions',
    title: '¿Qué es un Reforecast?',
    body: 'Es una nueva versión de un presupuesto ya aprobado, para ajustarlo a mitad de año sin perder el original. Copia automáticamente todas las líneas de la versión anterior para que solo tengas que cambiar lo que de verdad cambió.',
    moduleKeys: ['fpa'],
  },
  {
    id: 'fpa-whatif',
    title: '¿El Simulador What-If cambia algo de verdad?',
    body: 'No. Es una simulación de solo lectura — calcula qué pasaría con tu caja y tu resultado si aplicaras un cambio (ej. subir ventas 10%), pero nunca modifica ningún asiento contable ni ningún dato real, ni siquiera al guardar el escenario.',
    moduleKeys: ['fpa'],
  },
  {
    id: 'reports-drill-down',
    title: '¿Puedo ver el detalle detrás de un número de un reporte?',
    body: 'Sí. En el Estado de Resultados, haz clic en cualquier cuenta para desplegar su libro mayor real debajo — todos los movimientos que suman ese número, con fecha y número de asiento.',
    moduleKeys: ['reports'],
  },
  {
    id: 'reports-cash-flow-reconciles',
    title: '¿Qué significa "Cuadra" en el Flujo de Efectivo?',
    body: 'Confirma que el cambio de efectivo que calculó el reporte coincide exactamente con el cambio real de tus cuentas bancarias en ese periodo. Si algún día no cuadra, es señal de que hay un dato mal registrado en Contabilidad.',
    moduleKeys: ['reports'],
  },
  {
    id: 'metrics-vs-kpis',
    title: '¿En qué se diferencian las Métricas del Negocio de los KPIs de FP&A?',
    body: 'Una Métrica del Negocio es un número que tú escribes a mano (ej. clientes nuevos este mes). Un KPI de FP&A se calcula solo, con una fórmula sobre tus cuentas contables (ej. EBITDA). Son dos herramientas distintas para dos necesidades distintas.',
    moduleKeys: ['business-metrics'],
  },
  {
    id: 'advanced-analytics-automation',
    title: '¿Cómo funciona la automatización de un análisis?',
    body: 'Cuando activas la automatización de un análisis, el sistema lo corre solo todos los días según la frecuencia que elijas, y si el resultado cruza la condición que configuraste, te genera una alerta — sin que tengas que entrar a ejecutarlo a mano.',
    moduleKeys: ['advanced-analytics'],
  },
  {
    id: 'access-levels-quotas',
    title: '¿Por qué no puedo invitar a un Contador más?',
    body: 'Cada rol tiene un cupo máximo de usuarios activos por empresa (Contador: 3, Financiero: 4, Colaborador: 8, Administrador: sin límite). Si el cupo está lleno, hay que desactivar a alguien de ese rol o cambiarle el rol antes de invitar a otro.',
    moduleKeys: ['access-levels'],
  },
  {
    id: 'account-2fa',
    title: '¿Cómo activo la verificación en dos pasos?',
    body: 'Desde Mi Cuenta > Seguridad, activa la verificación en dos pasos y escanea el código QR con una app como Google Authenticator. Desde ese momento, cada inicio de sesión te va a pedir además el código de 6 dígitos de la app.',
    moduleKeys: ['account'],
  },
];

function listArticles(moduleKey) {
  if (!moduleKey) return HELP_ARTICLES;
  return HELP_ARTICLES.filter((a) => a.moduleKeys.includes(moduleKey));
}

function findArticleById(id) {
  return HELP_ARTICLES.find((a) => a.id === id) || null;
}

module.exports = { HELP_ARTICLES, listArticles, findArticleById };
