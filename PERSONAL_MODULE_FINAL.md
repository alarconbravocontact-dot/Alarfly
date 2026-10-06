# Módulo Personal — Documento final

Fecha: 2026-10-06
Ubicación en la jerarquía: **CONTROL → Personal** (junto a Fiscal), con 5
pestañas internas: Resumen / Personal / Nómina / Gastos / Ajustes.

## 1. Alcance (y lo que deliberadamente NO se construyó)

Este módulo es intencionalmente pequeño: registrar empleados, mantener su
ficha, controlar nómina, registrar gastos de personal, conocer el costo de
personal, conectar el dinero con Finanzas, y alimentar Control/Analítica.

**No se construyó** (lista explícita del pedido original, respetada al
pie de la letra): reclutamiento, vacaciones avanzadas, evaluación de
desempeño, entrevistas, capacitación, control biométrico, reloj de
marcaje, turnos complejos, portal del empleado, beneficios avanzados,
motor fiscal/laboral completo, contabilidad paralela, banca propia,
integraciones externas de pago, ni un segundo sistema de auditoría.

## 2. Auditoría previa — qué se reutilizó, qué se creó

Antes de escribir una sola línea de modelo, se auditó la arquitectura
existente. Resultado:

| Necesidad | Decisión | Por qué |
|---|---|---|
| Pago (nómina/reembolso) | Reutilizar `treasury/services/payment-orders.service.createPaymentOrder` tal cual | Ya acepta beneficiario de texto libre (`vendorId` opcional), cuenta de tesorería, cuenta contable a debitar, moneda, fecha — exactamente lo que necesita Personal. Nunca se creó un segundo sistema de pagos. |
| Obligación/asiento contable | Reutilizar `core/ledger.postEntry`, el único punto de escritura de `JournalEntry` en todo el proyecto | Regla de arquitectura ya establecida. Nómina y Gastos generan su asiento de "obligación reconocida" al aprobarse, igual que ya hacen AP/Fiscal. |
| Maker-checker | Reutilizar `core/workflow/segregation.rules.assertDifferentActors` | Ya es el primitivo genérico que usan PaymentOrder/PettyCash/PhysicalCount — quien aprueba un gasto nunca puede ser quien lo registró. |
| Centro de costo / departamento | Reutilizar `Dimension` (sucursal, `core/dimensions`) y `FpaDimension` (departamento/centro de costo, `modules/fpa`) | Ya existían, ya las usa el resto del sistema para etiquetar líneas de asiento. No se creó un tercer sistema de dimensiones. |
| Auditoría | Reutilizar `core/audit.log`/`listForEntities` | Ningún sistema de auditoría nuevo. |
| Permisos | Reutilizar `core/rbac` (`MODULE_ROLES`, `requireModuleAccess`) | Se agregó `personal: ['ADMIN', 'FINANCE']` al mapa ya existente — ninguna tabla de permisos nueva. |
| Moneda | Reutilizar el sistema de moneda ya existente (texto libre ISO, sin conversión retroactiva) | Mismo criterio que AR/AP/Tesorería. |
| Catálogo de Cliente/Proveedor equivalente | No existía un "Empleado" — se creó `Employee`, la única entidad genuinamente nueva de catálogo. | No había nada que reutilizar; es el núcleo del módulo. |

**Nada se duplicó.** No existe `PayrollLedger`, `PayrollAccounting`,
`EmployeeLedger`, un segundo `AccountsPayable`, ni un segundo sistema de
pagos — las prohibiciones explícitas de la sección 10 del pedido se
cumplieron en su totalidad.

## 3. Modelos de datos (schema.prisma)

Todos los modelos son **nuevos** (no existía ninguna entidad equivalente
que extender) y conviven, vía relaciones, con lo ya existente —
`Company`, `User`, `Dimension`, `FpaDimension`, `Account`, `JournalEntry`,
`PaymentOrder`:

- **`Employee`** — identificación (nombre, apellido, documento único por
  empresa, email, teléfono), información laboral (cargo, tipo de relación
  laboral, fecha de ingreso, estado Activo/Inactivo, sucursal→`Dimension`,
  departamento→`FpaDimension`, supervisor→auto-relación), información
  económica (salario base, moneda, frecuencia de pago, nota de método de
  pago). Opcionalmente ligado a un `User` real del sistema.
- **`PersonalSettings`** — singleton por empresa (mismo patrón que
  `ArApSettings`/`InventorySettings`): 4 cuentas contables configurables
  (gasto de nómina, pasivo de nómina por pagar, gasto de personal,
  pasivo de reembolsos por pagar).
- **`Payroll`** + **`PayrollItem`** — período de nómina (etiqueta, fechas,
  moneda, estado) con una línea por empleado (salario base congelado al
  calcular, desglose de ingresos/deducciones en JSON flexible —
  extensible sin migración, totales, orden de pago asociado).
- **`EmployeeExpense`** — gasto de personal (empleado, fecha, categoría,
  descripción, monto, moneda, comprobante en base64 igual que el resto
  del proyecto, estado, aprobación con motivo de rechazo, orden de pago
  de reembolso asociada).

Migración `20261006013544_personal_module` — 100% aditiva (solo
`CREATE TYPE`/`CREATE TABLE`/`CREATE INDEX`/`ADD CONSTRAINT`), revisada
línea por línea antes de aplicar. Aislamiento multiempresa: cada modelo
lleva `companyId` y todo query del servicio lo filtra siempre.

## 4. Flujo de Nómina

`DRAFT → CALCULATED → REVIEWED → APPROVED → PAID`, con reversas auditadas
`CALCULATED→DRAFT` y `REVIEWED→CALCULATED`. Una vez `PAID` es terminal —
no se puede editar ni revertir.

- **Calcular**: congela el salario base de cada empleado seleccionado,
  arma `PayrollItem` con ingresos/deducciones en 0 (editable mientras
  esté en `DRAFT`/`CALCULATED`).
- **Aprobar**: postea UN asiento contable combinado vía `core/ledger`
  (débito "Gasto de nómina" por empleado, etiquetado con la
  sucursal/departamento del empleado; crédito "Nómina por pagar" total) —
  esta es la "obligación reconocida" que pide la sección 10.
- **Pagar**: crea **una `PaymentOrder` por empleado** (reutilizando
  `payment-orders.service.createPaymentOrder` sin tocar su código),
  idempotente/resumible — si ya se crearon órdenes para algunos empleados
  y la llamada falla a mitad de camino, un segundo intento solo crea las
  que faltan. "Pagada" en Personal significa "entregada a Tesorería";
  Tesorería decide el resto del flujo de aprobación/liquidez con su
  propio motor, sin tocarlo.

## 5. Flujo de Gastos de Personal

`Registrado (PENDING_APPROVAL) → Aprobado/Rechazado → Reembolsado`.
Aprobar postea el asiento de obligación (débito "Gasto de personal",
crédito "Reembolsos por pagar"); reembolsar crea una `PaymentOrder` igual
que la nómina. Maker-checker real: quien registra el gasto no puede
decidirlo (`assertDifferentActors`).

## 6. Ficha del empleado

Una sola pantalla (`core/ui/RecordDrawer`) con: datos
personales/laborales/económicos, resumen (salario actual, última nómina,
total pagado, gastos pendientes, estado, fecha de ingreso), sus nóminas,
sus gastos, y una **línea de tiempo real** (`core/ui/DocumentTimeline`)
construida con `core/audit.listForEntities` sobre el propio empleado +
cada nómina + cada gasto donde participó — nunca un cálculo aparte, son
filas de auditoría reales traducidas a texto legible.

## 7. APIs (`/personal/*`, todas tras `requireAuth` + `requireModuleAccess('personal')`)

- `GET/POST /personal/employees`, `GET /:id`, `GET /:id/ficha`, `PATCH /:id`
- `GET/POST /personal/payroll`, `GET /:id`, `POST /:id/calculate`,
  `PATCH /:id/items/:itemId`, `POST /:id/review`,
  `POST /:id/send-back-to-draft`, `POST /:id/send-back-to-calculated`,
  `POST /:id/approve`, `POST /:id/pay`
- `GET/POST /personal/expenses`, `GET /:id`, `POST /:id/decide`,
  `POST /:id/reimburse`
- `GET/PATCH /personal/settings` (PATCH solo `ADMIN`)
- `GET /personal/dashboard`
- `GET /personal/treasury-accounts` — pase de solo lectura hacia
  Tesorería (ver sección 9, hallazgo real corregido)

## 8. Permisos

`core/rbac/module-access.js`: `personal: ['ADMIN', 'FINANCE']` — mismo
criterio que el resto de módulos financieros/sensibles del proyecto
(Contabilidad, FP&A). `COLLABORATOR` y `ACCOUNTANT` no entran al módulo
en absoluto (verificado explícitamente: ni en el menú, ni por URL
directa, ni por API). Configurar las cuentas contables del módulo
(`PATCH /personal/settings`) se restringe además a `ADMIN`.

## 9. Hallazgo real durante la verificación E2E (Playwright) y su corrección

**Síntoma**: la pantalla de Gastos mostraba 0 filas pese a que existían 2
gastos reales en la base de datos (confirmado con `curl` directo a
`GET /personal/expenses`, que sí devolvía los 2 registros con 200).

**Causa real**: `ExpensesPage.jsx`/`PayrollPage.jsx` cargan sus datos con
un solo `Promise.all([...])`, y una de esas llamadas
(`GET /treasury/accounts`, para el selector "pagar/reembolsar con…")
devolvía **403** para el rol Financiero — el gate de Tesorería es
`['ADMIN', 'COLLABORATOR']`, y Financiero (el único rol, junto a Admin,
que puede entrar a Personal) nunca estuvo en esa lista. Al rechazar una
promesa del `Promise.all`, la carga completa fallaba en silencio y
ocultaba la tabla entera.

**Corrección**: en vez de ampliar el gate de Tesorería (le habría dado a
Financiero acceso a TODO el módulo de Tesorería, mucho más amplio que lo
que necesitaba), se agregó un pase de solo lectura **dentro de Personal**
(`GET /personal/treasury-accounts`, controlador nuevo que llama
directamente al servicio ya existente de Tesorería sin duplicar su
lógica), gateado por el propio `requireModuleAccess('personal')` que
Financiero ya cumple. Verificado de nuevo con Playwright: Gastos ahora
muestra sus 2 filas reales, sin tocar en absoluto el acceso real a
Tesorería para ningún rol.

Se corrigió además, en el mismo pase, una advertencia real de consola de
React ("missing key prop") en `PayrollPage.jsx`, causada por usar el
atajo de Fragment `<>` (que no admite `key`) dentro de un `.map()`.

## 10. Pruebas

- **26 tests unitarios nuevos** (`payroll.rules.test.js` 13,
  `employee-expenses.rules.test.js` 6, `employees.service.test.js` 7)
  — transiciones de estado válidas/inválidas, cálculo de totales,
  maker-checker, aislamiento multiempresa, auditoría de campos
  sensibles. **779/779 tests del proyecto completo pasan**, sin
  regresiones.
- **Verificación real contra Postgres** (no mocks) con `curl`
  autenticado: partida doble balanceada en el asiento de nómina y en el
  de gastos, etiquetado correcto de `Dimension`/`FpaDimension` solo en
  las líneas de débito, maker-checker con mensajes exactos, una
  `PaymentOrder` real por empleado visible sin cambios en la propia
  pantalla de Tesorería, aislamiento multiempresa confirmado (una
  segunda empresa no puede ver ni por ID directo los datos de la
  primera).
- **Playwright de punta a punta** (rol Financiero): Resumen con 6
  tarjetas de KPI reales, lista de empleados, ficha con línea de tiempo
  real, creación de empleado nuevo, nómina de octubre ya pagada mostrada
  en modo solo-lectura, gastos reembolsados/rechazados visibles,
  Ajustes en modo solo-lectura para Financiero. Rol Colaborador:
  confirmado que NO ve "Personal" en el menú y recibe el mensaje de
  acceso denegado al entrar por URL directa.
- **Responsive**: 390px / 768px / escritorio en las 5 pantallas, sin
  overflow horizontal de página en ningún caso (las tablas usan el mismo
  mecanismo de scroll horizontal interno — `main.app-content { overflow-x:
  auto }` — que ya usa Contabilidad y el resto de módulos del proyecto;
  confirmado comparando ambos directamente).

## 11. Decisiones de diseño a recordar

- "Pagada" en Personal = "entregada a Tesorería" como `PaymentOrder`;
  el resto del ciclo de aprobación/liquidez lo decide Tesorería con su
  propio motor, sin que Personal lo vuelva a tocar.
- El desglose de ingresos/deducciones de cada `PayrollItem` vive en JSON
  (`incomeBreakdown`/`deductionBreakdown`), no en una tabla relacional
  tercera — mismo patrón ya usado por `AccountingRule.definition`/
  `FiscalRiskRule.condition` — para poder agregar conceptos nuevos sin
  rediseñar el módulo.
- No se inventó ningún porcentaje legal, prestación ni obligación fiscal
  de ningún país — "Ingresos"/"Deducciones" son genéricos a propósito.
- El pago a un empleado es **uno por uno** (una `PaymentOrder` por
  `PayrollItem`), no un solo pago agregado por toda la nómina — así cada
  empleado queda trazable individualmente en Tesorería.
