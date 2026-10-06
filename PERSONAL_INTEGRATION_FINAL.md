# Integración transversal del módulo Personal — Documento final

Fecha: 2026-10-06. Este documento complementa a `PERSONAL_MODULE_FINAL.md`
(que describe el módulo en sí, ya cerrado) — acá se documenta únicamente
el trabajo de **conectar** Personal con las áreas transversales de
Alarfly que ya existían: Dashboard, Finanzas, Analítica, Control y
Alertas. **No se reconstruyó el módulo ni se abrió una fase nueva.**

## 1. Auditoría quirúrgica — qué se encontró

Antes de tocar código se inspeccionó, puntualmente, cada punto de
integración real:

| Área | Mecanismo existente encontrado | Decisión |
|---|---|---|
| Dashboard | `reports/services/dashboard.service.js`: un registro de widgets (`WIDGET_DEFINITIONS`), cada uno con `roles`/`compute`, combinado con `DashboardWidgetPreference` (el usuario decide qué ve) | Registrar Personal como **un widget más** (`personal_summary`), nunca forzado |
| Finanzas | `finance/services/finance-summary.service.js`: capa de lectura que ya agrega Tesorería+AR+AP+Deuda en una sola respuesta (`GET /finance/summary`) | Agregar un campo nuevo (`personnelObligations`) a la MISMA respuesta, no una ruta nueva |
| Alertas | `core/alerts`: una tabla, un enum `AlertType`, `createAlertIfNotExists`, patrón "escanear y reconciliar" (AR/Inventario/Fiscal) + patrón "evento síncrono" (`APPROVAL_PENDING` de Tesorería) | Reutilizar el patrón "escanear" (más cercano a lo que Personal necesita — no hay una acción síncrona única que marque el cambio de estado) |
| Centros de costo | `Dimension` (sucursal) y `FpaDimension` (departamento) — Personal **ya** etiqueta con ambos al postear el asiento de nómina/gasto (construido en el módulo original) | Nada que hacer — ya funciona, confirmado de nuevo en esta pieza |
| Navegación | `CONTROL → Personal` ya existía, con `ModuleBreadcrumb`/RBAC ya cableados | Nada que tocar |
| Pagos | `treasury/services/payment-orders.service.createPaymentOrder` — Personal ya lo reutiliza | Nada que tocar |

**Hallazgo descartado explícitamente** (documentado, no convertido en
tarea nueva, tal como pide la instrucción): `payPayroll`/
`reimburseExpense` crean la `PaymentOrder` en estado `DRAFT` y nunca
llaman a `submitForApproval` — se verificó que esto es **exactamente**
el mismo comportamiento que ya tiene `createPaymentOrderForVendorBills`
(la conexión AP↔Tesorería existente): crear una orden nunca la envía a
aprobación sola, es una acción separada que alguien hace desde
Tesorería > Órdenes de Pago cuando está listo. No es un defecto de
Personal, es el patrón establecido — no se tocó.

## 2. Qué se modificó (backend)

- **`prisma/schema.prisma`**: 2 valores nuevos en el enum `AlertType`
  (`PAYROLL_ACTION_PENDING`, `EMPLOYEE_EXPENSE_ACTION_PENDING`) —
  migración `20261006023902_personal_integration_alerts`, 100%
  aditiva (`ALTER TYPE ... ADD VALUE`, nada más).
- **`src/core/alerts/alert-type.js`**: los 2 tipos agregados a la lista
  única (ambos validadores Zod del proyecto ya la importan — no hubo
  que tocarlos aparte, la "lección repetida" ya documentada en
  `CLAUDE.md` no se repitió una cuarta vez).
- **`src/core/account/services/notifications.service.js`**: etiquetas
  en español para los 2 tipos nuevos (Mi Cuenta > Notificaciones).
- **`frontend/src/config/alertLinks.js`**: a qué pantalla navega cada
  tipo nuevo (`/personal/nomina`, `/personal/gastos`).
- **`src/modules/personal/services/personal-dashboard.rules.js`**
  (nuevo): función pura `buildCostTrend` — mismo patrón que
  `ar-invoices.rules.buildSalesTrend` (separar lo puro/testeable de la
  consulta a base de datos).
- **`src/modules/personal/services/personal-dashboard.service.js`**:
  2 funciones nuevas, `getObligationsSummary` (agrupa nómina/gastos por
  estado accionable) y `getCostTrend` (evolución mensual, usa la regla
  pura de arriba) — ninguna reemplaza a `getDashboard`, que sigue igual.
- **`src/modules/personal/services/personal-alerts.service.js`**
  (nuevo): `scanPendingActions` — el escaneo, mismo patrón que
  `ar-collections.service.scanOverdueInvoices`.
- **`src/modules/personal/services/personal-alerts.cron.js`** (nuevo):
  corre a las 7:20am (después de Análisis Avanzados, 7:15am), registrado
  en `src/server.js`.
- **`src/modules/personal/controllers|routes/personal-alerts.*`**
  (nuevos): `POST /personal/alerts/scan` (disparo manual, mismo patrón
  que "Escanear cobranza atrasada" de AR).
- **`src/modules/personal/controllers|routes/personal-dashboard.*`**:
  nueva ruta `GET /personal/dashboard/trend?months=`.
- **`src/modules/finance/services/finance-summary.service.js`**:
  `getFinanceSummary(companyId, role)` — nuevo segundo parámetro,
  **opcional y retrocompatible** (los 3 llamadores existentes que no
  lo pasan — `insights.service`, el widget `finance_summary` del
  Dashboard, `glossary.service` — siguen funcionando igual, reciben
  `personnelObligations: null`, que ya ignoraban antes de esta pieza).
- **`src/modules/finance/controllers/finance-summary.controller.js`**:
  pasa `req.auth.role`.
- **`src/modules/reports/services/dashboard.service.js`**: nuevo
  widget `personal_summary` en el registro, `roles: ['ADMIN','FINANCE']`.

**Ninguna tabla nueva** (solo 2 valores de enum). **Ningún segundo
sistema** de pagos, contabilidad, auditoría, alertas o centros de
costo. **Cero cambios** a `payroll.service.js`/`employee-expenses.service.js`
(los servicios de negocio del módulo original quedaron intactos).

## 3. Qué se modificó (frontend)

- **`frontend/src/pages/DashboardPage.jsx`**: 2 tarjetas nuevas
  ("Costo de personal del período", "Nómina y gastos pendientes") en
  `EstadoWidgets`, cada una con un enlace real a Personal; 3 acciones
  rápidas nuevas (`+ Nuevo Empleado`/`+ Nueva Nómina`/`+ Registrar
  Gasto de Personal`), gateadas a `['ADMIN','FINANCE']`.
- **`frontend/src/pages/finance/ResumenPage.jsx`**: sección nueva
  "Obligaciones de personal" (2 `StatCard`), **solo se renderiza si
  `summary.personnelObligations` llega del backend** — para
  Colaborador/Contador llega `null` y la sección no aparece, sin
  relajar el permiso real de Personal por una puerta distinta.
- **`frontend/src/pages/personal/PersonalSummaryPage.jsx`**: botón
  "Escanear pendientes" (dispara el mismo escaneo del cron) y gráfico
  "Evolución del costo de personal" (`MetricTrendChart`, el mismo
  componente genérico que ya usa Métricas del Negocio — cero
  componentes nuevos).
- **`frontend/src/api/personal.js`**: `personalDashboardApi.getTrend`,
  `personalAlertsApi.scan`.

**Ningún componente de UI nuevo** — se reutilizaron `StatCard`,
`MetricTrendChart`, `Link`, los mismos botones/alert-box de siempre.

## 4. Verificación real (contra Postgres, con los 2 servidores corriendo)

- **Dashboard**: `GET /reports/dashboard` para Financiero devuelve el
  widget `personal_summary` con los 6 números reales (empleados
  activos, nómina del período, pendientes, costo total); para
  Colaborador el widget no aparece en absoluto.
- **Finanzas**: `GET /finance/summary` para Financiero incluye
  `personnelObligations` con los montos reales; para Contador
  (acceso a Finanzas, SIN acceso a Personal) llega `null` — verificado
  explícitamente que `totalPayable` (Cuentas por Pagar de AP) nunca
  incluyó los montos de Personal, confirmando que no hay doble conteo.
- **Flujo financiero completo**: se creó una nómina real dentro de un
  periodo contable abierto, se calculó, revisó y aprobó (como un
  segundo usuario, maker-checker respetado) → el asiento contable
  generado por `core/ledger` dio **balanceado** (700.00 = 700.00) → el
  escaneo de alertas generó la alerta "aprobada y pendiente de pago" →
  `GET /finance/summary` reflejó exactamente `payrollPendingPayment:
  700` → `GET /personal/dashboard` reflejó el mismo monto en
  `pendingPayroll` — la misma cifra, nunca recalculada dos veces.
- **Gastos**: se registró un gasto de personal real
  (`PENDING_APPROVAL`) → el escaneo generó la alerta de "pendiente de
  revisión" (severidad INFO) → visible en el Centro de Notificaciones
  con el enlace correcto a `/personal/gastos`.
- **Idempotencia del escaneo**: una segunda corrida inmediata no
  duplicó ninguna alerta (`createdCount: 0`), confirmando
  `createAlertIfNotExists`.
- **Aislamiento multiempresa** (sección 8 del pedido): se registró una
  empresa nueva desde cero (`POST /auth/signup`) y, con su propio
  usuario ADMIN, se confirmó que: el widget `personal_summary` del
  Dashboard muestra todo en 0 (no los datos de Empresa Demo);
  `personnelObligations` en Finanzas también en 0; un intento de leer
  por ID directo la nómina de Empresa Demo devuelve `404`; el listado
  de nóminas de la empresa nueva está vacío; el escaneo de alertas no
  crea nada (no ve las nóminas/gastos de la otra empresa); el Centro de
  Notificaciones de la empresa nueva no muestra ninguna alerta de tipo
  `PAYROLL_ACTION_PENDING`/`EMPLOYEE_EXPENSE_ACTION_PENDING` de Empresa
  Demo.
- **Frontend (Playwright)**: Inicio con las 2 tarjetas de Personal y
  sus enlaces funcionando (clic en "Ver Nómina →" navega a
  `/personal/nomina`); Finanzas > Resumen con la sección "Obligaciones
  de personal" visible para Financiero y ausente para Contador (ambos
  confirmados); Personal > Resumen con el botón de escaneo funcionando
  end-to-end y el gráfico de evolución renderizado con datos reales;
  Centro de Notificaciones mostrando la alerta real de nómina pendiente
  de pago (confirmado visualmente, con su insignia de conteo e icono de
  severidad correctos).
- **Responsive**: 390px/768px/escritorio en Inicio, Finanzas > Resumen
  y Personal > Resumen — 0 overflow horizontal en las 9 combinaciones.

## 5. Pruebas unitarias

11 tests nuevos (790/790 en total, sin regresiones):
- `personal-dashboard.rules.test.js` (4): `buildCostTrend` — mes sin
  costo en 0 (nunca "saltado"), suma correcta por mes, ignora datos
  fuera de rango, el último punto siempre es el mes de referencia.
- `personal-dashboard.service.test.js` (2): `getObligationsSummary`
  agrupa correctamente por estado y nunca devuelve `null`/`undefined`
  sin datos.
- `personal-alerts.service.test.js` (5): tipo/severidad correctos para
  cada uno de los 4 casos, y que una nómina `APPROVED` con todos sus
  ítems ya ligados a una `PaymentOrder` **no** genera una alerta
  redundante de "pendiente de pago".

`npm run lint` (backend): 0 errores. `npm run lint`/`npm run build`
(frontend): mismo baseline de 9 warnings preexistentes, sin warnings
nuevos.

## 6. Qué NO se modificó, y por qué

- **`payroll.service.js`/`employee-expenses.service.js`**: cero
  cambios — el escaneo lee el estado actual en vez de requerir hooks
  síncronos en el flujo de negocio ya probado.
- **El gate de Tesorería** (`treasury: ['ADMIN','COLLABORATOR']`): no
  se amplió para que Financiero vea más de Tesorería — el pase de
  solo lectura ya existente (`GET /personal/treasury-accounts`, de la
  pieza anterior) sigue siendo el único punto de contacto.
- **`listAlertsForUser`**: no se le agregó filtrado por rol/módulo.
  Se confirmó y documentó que esto es un comportamiento **transversal
  y preexistente** de TODO el motor de alertas (ningún tipo de alerta
  de ningún módulo —LOW_STOCK, FISCAL_OBLIGATION_DUE, etc.— filtra hoy
  por acceso a módulo, solo por preferencia de notificación del
  usuario) — Personal se integró de forma **idéntica** al resto, ni
  más ni menos expuesto. Cambiar esto sería una pieza de arquitectura
  nueva y transversal, fuera del alcance de "integrar Personal".
- **Insights con evidencia** (`reports/services/insights.service.js`):
  no se agregó un insight de Personal — el widget simple + la sección
  de Finanzas + la alerta ya cubren la necesidad sin construir una
  pieza de presentación más elaborada que no se pidió explícitamente.
- **Reporte de costo por departamento/sucursal**: no se construyó una
  pantalla de "costo por dimensión" nueva — los asientos de Personal
  YA están etiquetados con `Dimension`/`FpaDimension` en sus líneas de
  débito (desde el módulo original), así que cualquier reporte
  genérico por dimensión que exista o se construya más adelante los
  incluye automáticamente, sin que Personal necesite su propio reporte
  — documentado como decisión consciente, no como pendiente.

## 7. Cierre

Personal: **IMPLEMENTADO → INTEGRADO → PROBADO → AUDITADO →
DOCUMENTADO → CERRADO.**
