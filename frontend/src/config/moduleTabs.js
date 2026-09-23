// Lista de pestañas de cada módulo con navegación por pestañas —
// única fuente de verdad, reutilizada por el propio Layout del módulo
// (pestañas + ModuleBreadcrumb) y por el mini-panel del menú lateral
// colapsado (AppLayout, Feature M). Vive en un archivo aparte (no
// JSX) para que ningún Layout mezcle un export de componente con un
// export de datos — evita la advertencia de Fast Refresh de React.

export const ACCOUNTING_TABS = [
  { to: '/contabilidad/cuentas', label: 'Plan de Cuentas' },
  { to: '/contabilidad/asientos', label: 'Asientos Contables' },
  { to: '/contabilidad/reportes', label: 'Reportes' },
  { to: '/contabilidad/periodos', label: 'Periodos' },
];

export const TREASURY_TABS = [
  { to: '/tesoreria/cuentas', label: 'Cuentas y Caja' },
  { to: '/tesoreria/conciliacion', label: 'Conciliación Bancaria' },
  { to: '/tesoreria/tarjetas', label: 'Tarjetas de Crédito' },
  { to: '/tesoreria/pagos', label: 'Órdenes de Pago' },
  { to: '/tesoreria/deuda', label: 'Deuda' },
  { to: '/tesoreria/caja-chica', label: 'Caja Chica' },
  { to: '/tesoreria/alertas', label: 'Alertas' },
  { to: '/tesoreria/liquidez', label: 'Previsión de Liquidez' },
];

export const AR_AP_TABS = [
  { to: '/cuentas/clientes', label: 'Clientes' },
  { to: '/cuentas/facturas-venta', label: 'Facturas de Venta' },
  { to: '/cuentas/cobros', label: 'Cobros' },
  { to: '/cuentas/notas-credito', label: 'Notas de Crédito' },
  { to: '/cuentas/proveedores', label: 'Proveedores' },
  { to: '/cuentas/facturas-compra', label: 'Facturas de Compra' },
  { to: '/cuentas/pagos', label: 'Pagos a Proveedores' },
];

export const INVENTORY_TABS = [
  { to: '/inventario/catalogo', label: 'Catálogo' },
  { to: '/inventario/almacenes', label: 'Almacenes' },
  { to: '/inventario/stock', label: 'Stock y Valoración' },
  { to: '/inventario/movimientos', label: 'Movimientos' },
  { to: '/inventario/transferencias', label: 'Transferencias' },
  { to: '/inventario/conteos', label: 'Conteos Físicos' },
  { to: '/inventario/compras', label: 'Órdenes de Compra' },
  { to: '/inventario/lotes', label: 'Lotes y Vencimientos' },
];

export const FISCAL_TABS = [
  { to: '/fiscal/impuestos', label: 'Impuestos y Tasas' },
  { to: '/fiscal/transacciones', label: 'Transacciones' },
  { to: '/fiscal/reglas-de-riesgo', label: 'Reglas de Riesgo' },
  { to: '/fiscal/libros', label: 'Libros Fiscales' },
  { to: '/fiscal/facturacion-electronica', label: 'Facturación Electrónica' },
  { to: '/fiscal/calendario', label: 'Calendario Fiscal' },
  { to: '/fiscal/documentos', label: 'Documentos' },
];

export const FPA_TABS = [
  { to: '/fpa/dimensiones', label: 'Dimensiones' },
  { to: '/fpa/presupuestos', label: 'Presupuestos' },
  { to: '/fpa/desviaciones', label: 'Desviaciones' },
  { to: '/fpa/simulador', label: 'Simulador What-If' },
  { to: '/fpa/kpis', label: 'KPIs' },
];

export const REPORTS_TABS = [
  { to: '/reportes/estados-financieros', label: 'Estados Financieros' },
  { to: '/reportes/flujo-de-efectivo', label: 'Flujo de Efectivo' },
  { to: '/reportes/rentabilidad', label: 'Rentabilidad' },
  { to: '/reportes/antiguedad-de-saldos', label: 'Antigüedad de Saldos' },
  { to: '/reportes/consolidacion', label: 'Consolidación' },
  { to: '/reportes/tablero-ejecutivo', label: 'Tablero Ejecutivo' },
  { to: '/reportes/exportar', label: 'Exportar y Programar' },
];

export const ADVANCED_ANALYTICS_TABS = [
  { to: '/analisis-avanzados/catalogo', label: 'Catálogo' },
  { to: '/analisis-avanzados/repositorio', label: 'Repositorio de Reportes' },
  { to: '/analisis-avanzados/benchmarking', label: 'Benchmarking' },
];

// Fase 3 — Ventas: Venta Rápida primero a propósito (es el flujo del
// día a día, punto 20 del prompt de Fase 3), Pedidos/Entregas después
// (el ciclo completo, opcional).
export const SALES_TABS = [
  { to: '/ventas/rapida', label: 'Venta Rápida' },
  { to: '/ventas/pedidos', label: 'Pedidos' },
  { to: '/ventas/entregas', label: 'Entregas' },
];

// Prefijo de ruta → moduleKey del backend (los mismos strings que ya
// usa `core/rbac/module-access.js`) — única fuente de verdad para que
// el botón de ayuda contextual (Feature Q) sepa en qué módulo está el
// usuario sin duplicar esta lista en otro lugar. Ordenado del más
// específico al más genérico porque se recorre con `startsWith`.
export const ROUTE_MODULE_KEYS = [
  { prefix: '/contabilidad', moduleKey: 'accounting' },
  { prefix: '/tesoreria', moduleKey: 'treasury' },
  { prefix: '/cuentas', moduleKey: 'accounts-receivable' },
  { prefix: '/ventas', moduleKey: 'sales' },
  { prefix: '/inventario', moduleKey: 'inventory' },
  { prefix: '/fiscal', moduleKey: 'fiscal' },
  { prefix: '/fpa', moduleKey: 'fpa' },
  { prefix: '/reportes', moduleKey: 'reports' },
  { prefix: '/metricas', moduleKey: 'business-metrics' },
  { prefix: '/analisis-avanzados', moduleKey: 'advanced-analytics' },
  { prefix: '/niveles-de-acceso', moduleKey: 'access-levels' },
  { prefix: '/mi-cuenta', moduleKey: 'account' },
];

export function moduleKeyForPath(pathname) {
  const match = ROUTE_MODULE_KEYS.find((r) => pathname.startsWith(r.prefix));
  return match ? match.moduleKey : 'dashboard';
}
