# PROGRESS_LOG.md — Bitácora de evolución de Alarfly

> Memoria arquitectónica del proyecto. Se actualiza al cerrar cada fase.
> Léelo completo antes de empezar cualquier fase nueva, junto con
> `CLAUDE.md` y `docs/ARQUITECTURA_MAESTRA.md`.

---

## Fase 0 — Auditoría Integral

**Estado: FASE COMPLETA**

Auditoría de solo lectura del proyecto real (extraído de `Alarfly 1.3.zip`,
nunca antes desempaquetado en el repo). Sin cambios de código. Informe
completo (secciones A–T, evidencia archivo:línea) publicado como documento
aparte y entregado para revisión. Resumen de los hallazgos que motivaron
la Fase 1: el Ledger (`postEntry`) no acepta transacción externa, por lo
que los 8 módulos de negocio postean el asiento en una transacción propia
y escriben su documento en otra — sin una sola excepción atómica en todo
el código; `TreasuryAccount.currentBalance` se actualiza dos veces para el
mismo movimiento real (registro operativo + importación de extracto);
`PaymentOrder` y `ApPayment` son caminos de pago duplicados; no hay
infraestructura de idempotencia formal. También se confirmaron piezas
sólidas a preservar: partida doble, bloqueo de período, valoración
FIFO/LIFO/PMP, maker-checker de conteos, cobros AR, maestros compartidos,
Design System.

---

## Fase 1 — CORE, Ledger e Integridad Transaccional

**Estado: FASE COMPLETA**

### Objetivo de la fase

Construir una base transaccional sólida: que las operaciones críticas
(documento de negocio → Ledger → auditoría, y cuando aplica, el saldo de
Tesorería) queden todas aplicadas o ninguna, sin tocar todavía ciclos
funcionales nuevos (ventas, inventario nuevo, dashboard, RBAC nuevo,
aprobaciones nuevas — eso es de fases posteriores).

### Qué se hizo

**1. Se extrajo el proyecto real al repositorio.** El código (backend +
frontend) solo existía como `Alarfly 1.3.zip`, nunca desempaquetado como
fuente en git. Se desempaquetó y se comprometió como línea base antes de
tocar nada (commit `df8d365`).

**2. Unit of Work (`src/core/database/unit-of-work.js`, nuevo, 15
líneas).** No es un motor de transacciones nuevo: es el mismo
`prisma.$transaction` de siempre, con una sola forma de threading
(`withTransaction(work, tx)`) — generaliza un patrón que YA existía de
forma aislada en el proyecto (`audit.service.log(data, tx = prisma)`,
`arApSettingsService.getNextArInvoiceNumber(companyId, tx)`) y lo aplica
también al Ledger, que era la pieza que faltaba. Cumple la Regla
Anti-Duplicación: se extendió el patrón existente, no se inventó uno
nuevo.

**3. `ledger.service.js:postEntry` ahora acepta un segundo parámetro
`tx` opcional.** Si se pasa, participa en esa transacción externa; si no,
se comporta exactamente igual que antes (abre su propia transacción —
ningún llamador que no pase `tx` cambia de comportamiento). Se
preservaron sin tocar: partida doble, validación de cuentas, numeración
consecutiva, bloqueo de período, `sourceModule`/`sourceReference`,
dimensiones, FX, estados de aprobación, reversión — nada de esa lógica se
reescribió ni se simplificó.

**4. Se migraron a una sola transacción (Ledger + escritura del módulo +
auditoría, y saldo de Tesorería cuando aplica) los 12 puntos críticos
identificados en la auditoría:**

| # | Archivo → función | Antes | Ahora |
|---|---|---|---|
| 1 | `fiscal-transactions.service.js` → `createFiscalTransaction` | Ledger en su tx, `FiscalTransaction` en otra | Acepta `tx`; una sola transacción |
| 2 | `ar-invoices.service.js` → `createInvoice` | 3 transacciones (Ledger → Fiscal → Factura) | 1 transacción |
| 3 | `ap-bills.service.js` → `createBill` | 3 transacciones | 1 transacción |
| 4 | `ar-payments.service.js` → `recordPayment` | 2 transacciones | 1 transacción; agregado `sourceReference` que faltaba |
| 5 | `ap-payments.service.js` → `recordPayment` | 2 transacciones | 1 transacción; agregado `sourceReference` |
| 6 | `ar-credit-notes.service.js` → `createCreditNote` | 2 transacciones | 1 transacción |
| 7-10 | `inventory-movements.service.js` → `createEntry`, `createExit`, `createBomExit`, `createAdjustment` | 2 transacciones cada una | 1 transacción cada una |
| 11 | `payment-orders.service.js` → `decideApproval` (nivel final) | 2 transacciones | 1 transacción |
| 12-15 | `debts.service.js` → `disburseLoan`, `drawdown`, `repayCreditLine`, `payInstallment` | 2 transacciones cada una | 1 transacción cada una |
| 16-17 | `petty-cash.service.js` → `decideExpense`, `replenishFund` | 2 transacciones cada una | 1 transacción cada una |
| 18 | `reconciliation.service.js` → `matchWithNewEntry` | 2 transacciones, sin tocar saldo | 1 transacción; ahora sí ajusta el saldo (es el único punto legítimo) |
| 19 | `fixed-assets.service.js` → `depreciateAsset` | **El peor caso**: sin transacción en el 2º paso, sin auditoría | 1 transacción; con auditoría |

**No migrados (evaluados y descartados, no necesitan el patrón):**
`core/fx/fx.service.js:revalueAccount` y
`accounting/controllers/journal-entries.controller.js` (creación manual
de asiento) — ambos son operaciones de un solo efecto (el asiento ES la
única escritura), no hay un segundo documento con el que coordinar
atomicidad. Aplicar el patrón ahí no habría corregido ningún riesgo real.

**5. Corrección de `TreasuryAccount.currentBalance` (doble
contabilización, confirmada en la auditoría).** Diagnóstico: el saldo se
incrementaba/decrementaba al registrar la operación (cobro, pago, orden
de pago, deuda, caja chica) **y otra vez** al importar el extracto
bancario que mostraba ese mismo movimiento — sin ninguna deduplicación
entre ambos caminos.

Solución (sin migración de base de datos, sin campos nuevos): la
importación de extractos (`statement-import.service.js`) **ya no toca
`currentBalance`** — solo trae los `BankTransaction` en bruto para que la
conciliación los empareje. El único punto donde un movimiento bancario
puede afectar el saldo es `reconciliation.service.js:matchWithNewEntry`,
cuando un humano confirma explícitamente que ese movimiento no tiene
ningún asiento previo (dinero real sin registrar) — y eso ahora ocurre en
la misma transacción que el asiento que genera. Probado con un escenario
real de punta a punta (cobro operativo + importación del mismo movimiento
→ el saldo NO se duplica; un movimiento sin registro previo → el saldo sí
se ajusta, una sola vez, al conciliarlo).

**6. Idempotencia: facturación recurrente automática.** Riesgo
confirmado en la auditoría: `ar-recurring.service.js:generateFromTemplate`
creaba la factura y luego, en un paso separado sin transacción, marcaba
`template.lastGeneratedAt` — un fallo entre ambos pasos hacía que el
próximo cron generara una factura y un asiento duplicados. Ahora ambos
pasos están en la misma transacción: se usa la capacidad de `tx` que ya
se le agregó a `ar-invoices.service.js:createInvoice`.

**7. Auditoría.** `audit.service.js` no se tocó (su diseño ya era
correcto: acepta `tx` opcional, nunca guarda contraseñas/secretos). Se
agregó el registro de auditoría que faltaba en `depreciateAsset`
(`fixed_asset.depreciated`).

**8. Tests nuevos (integración real contra Postgres, sin mocks — se
levantó un Postgres 16 local y se aplicaron las 39 migraciones
existentes):**

- `src/core/ledger/ledger.transaction.integration.test.js` (6 tests):
  `postEntry` con y sin `tx` externa; **prueba explícita de atomicidad**
  (documento + Ledger + error deliberado + auditoría → ROLLBACK completo,
  verificado que nada queda a medias); `withTransaction` reutiliza el
  cliente recibido en vez de anidar.
- `src/modules/treasury/services/treasury-balance.integration.test.js`
  (2 tests): **prueba explícita de doble contabilización** con el flujo
  real (cobro AR + importación del mismo movimiento no duplica el saldo;
  un movimiento sin registro previo sí lo ajusta, una vez, al
  conciliarlo).
- `src/modules/accounting/services/fixed-assets-depreciation.integration.test.js`
  (2 tests): el caso más roto de la auditoría, ahora atómico y auditado;
  no se duplica si se corre dos veces el mismo mes.
- `src/modules/accounts-receivable/services/ar-recurring-idempotency.integration.test.js`
  (2 tests): la factura recurrente y `lastGeneratedAt` quedan atómicos;
  correr el cron dos veces seguidas no duplica la factura.
- `src/test-helpers/integration-fixtures.js`: fixtures compartidos
  (empresa, cuentas, período abierto, cliente, cuenta de tesorería) para
  las pruebas de integración.

**Resultado de tests:** 82 suites, 514 tests, todos en verde (502
existentes + 12 nuevos). `eslint` sin advertencias. Servidor arranca sin
errores (`node src/server.js` → responde en el puerto 3000).

### Qué NO se hizo (fuera de alcance, tal como se pidió)

Nuevo diseño visual, nuevo Dashboard/Centro Operativo Inteligente, nueva
navegación, Venta Rápida, `SalesOrder`/`SalesDelivery`/`GoodsReceipt`,
nuevo sistema de inventario, nuevo sistema de pagos, nuevo RBAC, nuevo
motor de aprobaciones, afiliados, landing page, rediseño de frontend.

### Base de datos

**Cero migraciones nuevas.** Todos los fixes de Fase 1 se lograron con
cambios de código (fronteras de transacción), sin tocar `schema.prisma`
— se evaluó explícitamente si hacía falta un cambio estructural (ej.
separar saldo contable/bancario/discrepancia en campos nuevos para
Tesorería) y se concluyó que no: el problema real era un bug de
doble-escritura, no una falta de modelo de datos.

### APIs

No se rompió ninguna interfaz existente. `postEntry`,
`createFiscalTransaction`, `getNextArInvoiceNumber/ApBillNumber/ArCreditNoteNumber`,
`createInvoice` ganaron un parámetro `tx` opcional al final — todo
llamador existente que no lo pasa sigue funcionando exactamente igual.

### Decisiones arquitectónicas

- El Unit of Work es una función de 5 líneas sobre `prisma.$transaction`,
  no una abstracción nueva — se prefirió extender el patrón `tx`
  opcional que el proyecto ya usaba en `audit.service`/`ar-ap-settings`
  antes que introducir un concepto distinto.
- La corrección de Tesorería se resolvió reasignando responsabilidad
  (qué paso tiene permitido tocar el saldo) en vez de agregar columnas
  nuevas — más simple y con menor superficie de riesgo.
- Se dejó fuera del alcance la fusión completa de `PaymentOrder`/
  `ApPayment`/`ArPayment`/`Debt` en una sola cadena de pago (duplicación
  ya documentada en la Fase 0): esta fase solo garantizó que cada camino
  existente sea atómico por dentro, no los unificó. Se documenta como
  pendiente explícito para una fase posterior (ver abajo).

### Pendientes para fases siguientes

1. **Fusionar `PaymentOrder`/`ApPayment`/`ArPayment`/`Debt`** en una sola
   cadena obligación → intención de pago → ejecución → aplicación (Fase 0,
   hallazgo "Alta"). No se tocó en Fase 1 a propósito: la orden explícita
   era garantizar atomicidad de lo que ya existe, no rediseñar el flujo de
   pagos.
2. **Motor de aprobaciones genérico/polimórfico** — hoy sigue atado a
   `PaymentOrder` (`payment-approval.rules.js`). Migrarlo a "un único
   motor transversal" es trabajo de una fase de Control/Workflow.
3. **`reverseMatch` (reconciliation.service.js) no deshace el ajuste de
   saldo que generó `matchWithNewEntry`.** Es una laguna real de
   reversión: si se revierte un emparejamiento que había generado un
   asiento nuevo y movido el saldo, el saldo no vuelve atrás
   automáticamente. No se resolvió en Fase 1 porque hacerlo bien requiere
   saber, en `reverseMatch`, si el match que se revierte vino de
   `matchWithNewEntry` o de un emparejamiento normal — que es una decisión
   de flujo de reversión, no de atomicidad. Documentado explícitamente en
   vez de improvisar una solución.
4. **Otros cron jobs** (`alerts.cron`, `fiscal-alerts.cron`,
   `inventory-alerts.cron`) no tienen `lastRunAt`/registro explícito de
   ejecución — hoy dependen del dedupe de `core/alerts/alerts.service.js`.
   Evaluados como riesgo menor en la Fase 0; no se tocaron por no ser
   estrictamente necesarios para la integridad transaccional que pedía
   esta fase.
5. **RBAC granular** (acción+recurso+contexto), navegación por proceso de
   negocio, ciclo comercial completo (`SalesOrder`/`SalesDelivery`/
   `GoodsReceipt`) — pendientes de fases posteriores según los documentos
   de arquitectura objetivo (Fase 0, §J).

### Riesgos conocidos

- El ajuste TOCTOU teórico entre la lectura de período y el commit de
  `postEntry` (bajísima probabilidad, ya existía antes de esta fase, no
  se agravó).
- `fx.service.js:revalueAccount` y la creación manual de asientos
  (`journal-entries.controller.js`) siguen sin aceptar `tx` externo —
  evaluado y descartado a propósito (no tienen un segundo documento con
  el que coordinar atomicidad); si una fase futura los usa dentro de un
  flujo compuesto, habrá que extenderlos con el mismo patrón.
- Los entornos de este proyecto no traían Postgres corriendo; se levantó
  uno local (`localhost:5432`, rol/DB `alarfly`) para poder probar contra
  base real en vez de mocks. Cualquier entorno de ejecución futuro
  necesita su propia base de datos con las migraciones aplicadas
  (`npx prisma migrate deploy`).

### Impacto en fases futuras

La próxima fase que toque Ventas, Compras o Tesorería debe **reutilizar**
`withTransaction`/el parámetro `tx` de `postEntry` para cualquier
operación crítica nueva (`SalesOrder → Reserva → Entrega`, `GoodsReceipt`,
etc.) en vez de repetir el patrón antiguo de dos transacciones. Cualquier
fase que toque pagos debe partir del inventario de duplicación
documentado arriba (pendiente #1) antes de crear nada nuevo.

---

## Fase 2 — Maestros y Datos Base

**Estado: FASE COMPLETA**

### Objetivo de la fase

Auditar y preparar los datos maestros transversales (Producto,
Variantes, Categorías, UOM, Clientes, Proveedores, Empresa/Sucursales,
Monedas, Dimensiones) para que las fases posteriores (Ventas/Facturación
en Fase 3) los usen sin duplicarlos. No crear módulos nuevos: garantizar
una sola fuente de verdad por entidad.

### Qué existía antes (auditoría, sin asumir nada — código leído primero)

- `Product`/`ProductVariant`/`ProductCategory`/`UnitOfMeasure` ya eran
  maestros únicos y transversales (Inventario, Fiscal vía AR/AP,
  Contabilidad vía cuentas de inventario/COGS, FP&A vía
  `Product.fpaDimensionId`, Reportes de rentabilidad). Sin duplicados
  conceptuales: una sola tabla de categorías, una sola de UOM.
- `Customer`/`Vendor` ya eran catálogos únicos y transversales (AR/CxC/
  Fiscal/Analítica; AP/CxP/Fiscal/Analítica respectivamente) — sin
  modelos alternativos en ningún otro módulo.
- `ArApSettings` (en `core/ar-ap-settings`) ya era la única fuente de
  configuración compartida entre AR y AP.
- Sucursales: sin modelo `Branch` propio — se representan con
  `Dimension` tipo `BRANCH`, ya usada de forma consistente por
  `Warehouse`, `TreasuryAccount` y `PettyCashFund`.
- Monedas: sin modelo `Currency` propio — `Company.baseCurrency` (texto
  ISO) + `ExchangeRate` (histórico companyId+currency+date+rate) ya
  cubren lo que existe hoy.
- Dos sistemas de dimensiones ya coexistían a propósito, documentados
  desde antes de esta fase: `Dimension` (plano, con código, usado por
  Tesorería/Inventario/Fiscal) y `FpaDimension` (jerárquico, sin
  código, usado por FP&A/Presupuestos/Rentabilidad/`Product.fpaDimensionId`),
  cada uno con su propia tabla puente hacia `JournalEntryLine`.
- Gaps reales encontrados (no supuestos — confirmados leyendo servicios,
  rutas, validators y el frontend):
  1. `createProduct`/`updateProduct`/`addVariant`, `createCustomer`/
     `updateCustomer`, `createVendor`/`updateVendor` **no auditaban
     nada** (Customer solo auditaba bloquear/desbloquear; Vendor no
     auditaba absolutamente nada, ni siquiera activar/desactivar, que
     el frontend de `VendorsPage` ya permitía hacer sin dejar rastro).
  2. `ProductCategory`/`UnitOfMeasure` no tenían **ni edición ni
     estado activo/inactivo** — una vez creadas, vivían para siempre
     (solo existía `POST`/`GET`, ninguna ruta `PATCH`).
  3. `core/middlewares/errorHandler.js` no traducía `P2002` (violación
     de restricción única) — cualquier intento de crear un
     cliente/proveedor/producto/categoría/UOM duplicado por la vía
     normal (no la de importación, que sí tenía su propio traductor
     ad-hoc) caía en el 500 genérico ("error inesperado"), en vez de
     un 409 claro. Confirmado en vivo antes del fix: `POST
     /accounts-receivable/customers` con un nombre repetido devolvía
     500; después del fix, 409 `DUPLICATE_VALUE`.
  4. Cero tests unitarios para `products.service.js`,
     `vendors.service.js`, `product-categories.service.js`,
     `units-of-measure.service.js` (`customers.service.test.js` solo
     cubría `importCustomers`).
  5. Frontend: `productsApi.update`/`customersApi.update` ya existían
     en el cliente HTTP y el backend, pero ninguna pantalla ofrecía un
     botón para usarlos (a diferencia de `VendorsPage`, que sí tenía
     el botón Activar/Desactivar).

### Qué se reutilizó (sin tocar)

- El motor de valoración de Inventario (FIFO/LIFO/PMP), BOM, el motor
  fiscal, el motor de asientos (`core/ledger`), `core/audit` (mismo
  servicio de siempre, sin cambios), `ArApSettings`, `core/fx`, ambos
  sistemas de `Dimension`/`FpaDimension` — nada de esto se tocó ni se
  reconstruyó.
- El patrón `tx` opcional de la Fase 1 (`withTransaction`/transacción
  de Prisma) para que cada creación/modificación con auditoría nueva
  quede atómica junto con su registro de `AuditLog` — mismo criterio
  que ya se usó en Fase 1, no un mecanismo nuevo.

### Qué se modificó / extendió

1. **Auditoría agregada** a `createProduct`/`updateProduct`/
   `addVariant` (`product.created`/`product.updated`/
   `product.variant_added`), `createCustomer`/`updateCustomer`
   (`customer.created`/`customer.updated`), `createVendor`/
   `updateVendor` (`vendor.created`/`vendor.updated`) — cada
   creación/modificación queda ahora en `AuditLog`, con el estado
   anterior cuando el cambio es `isActive`.
2. **CRUD completado** para `ProductCategory`/`UnitOfMeasure`:
   `updateCategory`/`updateUnitOfMeasure` (nuevas), con auditoría y
   validación de existencia — mismo patrón que ya usaban Product/
   Customer/Vendor.
3. **`core/middlewares/errorHandler.js`** ganó manejo genérico de
   `P2002` → 409 `DUPLICATE_VALUE` con mensaje claro. Beneficia a los
   5 maestros (y cualquier otro modelo con restricción única) sin
   duplicar la traducción servicio por servicio.
4. **Frontend**: `unitsOfMeasureApi.update`/`productCategoriesApi.update`
   agregados al cliente HTTP; botón Activar/Desactivar agregado a
   `CatalogPage` (productos, que no lo tenía) y a `CustomersPage`
   (clientes, que tampoco lo tenía) — mismo patrón visual ya usado en
   `VendorsPage`, sin ningún rediseño.

### Qué se creó

- `isActive Boolean @default(true)` en `ProductCategory` y
  `UnitOfMeasure` (migración `20260923012625_master_data_category_uom_isactive`,
  puramente aditiva: dos `ALTER TABLE ... ADD COLUMN ... DEFAULT true`,
  sin pérdida de datos ni downtime).
- Rutas `PATCH /inventory/categories/:id` y
  `PATCH /inventory/units-of-measure/:id` (+ filtro `?isActive=` en
  ambos `GET /`, mismo patrón que ya usaban Product/Customer/Vendor).
- 5 archivos de test nuevos: `products.service.test.js`,
  `vendors.service.test.js`, `product-categories.service.test.js`,
  `units-of-measure.service.test.js`, `errorHandler.test.js`.

### Qué se fusionó / eliminó

Nada. La auditoría no encontró ningún maestro duplicado que fusionar
(Product/Customer/Vendor/Category/UOM ya eran fuente única desde antes)
ni ningún código muerto que eliminar.

### Decisión explícita: NO fusionar `Dimension` y `FpaDimension`

Evaluado y descartado a propósito. Fusionarlos tocaría el Ledger (dos
tablas puente distintas — `JournalEntryLineDimension` y
`JournalEntryLineFpaDimension` — ambas colgando de `JournalEntryLine`)
y decenas de consumidores ya probados (Tesorería/Inventario/Fiscal por
un lado; FP&A/Presupuestos/Rentabilidad/`Product.fpaDimensionId` por
el otro). Es una decisión ya documentada como consciente antes de esta
fase, y la regla 17 de este mismo prompt de Fase 2 pide explícitamente
no tocar el Ledger salvo estrictamente necesario — no lo era: ambos
sistemas funcionan, cada uno resuelve un problema distinto (etiquetado
operacional plano vs. analítico jerárquico), y no hay ningún módulo
que hoy necesite mezclarlos.

### Pendiente documentado, no implementado (con justificación)

- **Precio/costo/impuesto por defecto en `Product`**: hoy ningún
  consumidor real los necesita (AR/AP toman `unitPrice` manual por
  línea de factura; el costo real ya lo resuelve el motor de
  valoración; el impuesto se resuelve por jurisdicción en la
  transacción fiscal, no por producto). Agregar estos campos ahora
  violaría la regla explícita de "no agregar campos sin justificación
  funcional". Cuando Fase 3 defina cómo funciona Venta Rápida, ahí se
  sabrá si de verdad hace falta un precio de lista por producto — se
  deja documentado para no perder el razonamiento.
- **Unicidad de `taxId`** en `Customer`/`Vendor`: hoy solo `name` es
  único por empresa; `taxId` puede repetirse o quedar vacío (permite
  crear un cliente antes de tener su NIT/RFC completo, decisión ya
  documentada en `CLAUDE.md`). No se impuso una restricción nueva sin
  evidencia de duplicados reales en producción — queda como riesgo
  menor a vigilar, no como bug.
- **Frontend de Categorías/UOM**: el backend quedó completo (`PATCH`,
  auditoría, `isActive`), pero la sección de Categorías/UOM en
  `CatalogPage` sigue mostrando una lista de texto plano (nombres
  separados por comas), no una tabla por fila — agregar un botón
  Activar/Desactivar ahí exige restructurar esa presentación, que va
  más allá de "conectar un botón ya existente" (lo que sí se hizo para
  Producto/Cliente) y roza el rediseño visual que esta fase pidió
  explícitamente no hacer todavía. Documentado como pendiente de una
  pasada de frontend futura, no como incompleto de datos/contratos.

### Migraciones

Una migración nueva, mínima y aditiva (ver arriba). Se evaluó primero
si era necesaria (regla 22): sin ella, `ProductCategory`/
`UnitOfMeasure` seguirían sin ninguna forma de desactivarse, la única
inconsistencia real de estado encontrada frente al resto de maestros
del proyecto (Product/Customer/Vendor/Warehouse/TreasuryAccount ya
tenían `isActive`). Aplicada y verificada con `prisma migrate dev`
contra Postgres real, sin pérdida de datos (default `true` para las
filas existentes).

### APIs

Ninguna ruta existente cambió de comportamiento. Nuevas: `PATCH
/inventory/categories/:id`, `PATCH /inventory/units-of-measure/:id`.
Ampliadas de forma compatible (parámetro opcional): `GET
/inventory/categories?isActive=`, `GET
/inventory/units-of-measure?isActive=`.

### Auditoría

Verificado en vivo contra Postgres real: crear/desactivar un proveedor
ahora deja `vendor.created`/`vendor.updated` en `AuditLog` (antes, cero
filas). Mismo patrón confirmado para Producto/Cliente/Categoría/UOM.

### Tests y resultado

87 suites, 535 tests, todos en verde (514 preexistentes de Fase 1 +
tests nuevos de esta fase, sin ninguna regresión). `eslint` sobre el
backend sin advertencias. Frontend: `npm run lint` (oxlint) sin
advertencias nuevas (mismas 8 preexistentes de los archivos de
contexto) y `npm run build` sin errores.

Verificado además a mano contra Postgres real (no solo con mocks):
categoría duplicada → 409 `DUPLICATE_VALUE` (antes 500); `PATCH` de
categoría/proveedor funcionando; filtro `?isActive=true` excluyendo
correctamente una categoría recién desactivada; `AuditLog` con las
filas nuevas de proveedor.

### Riesgos

- Ninguno nuevo introducido por esta fase (cambios aditivos, sin tocar
  Ledger, sin tocar lógica de negocio existente).
- Persisten los riesgos ya documentados en Fase 1 (TOCTOU de período,
  `reverseMatch` sin revertir saldo, crons sin `lastRunAt`).

### Impacto sobre Fase 3 (Ventas, Facturación, Venta Rápida y CxC)

- `Product`/`Customer`/`Vendor` están listos para usarse tal cual —
  **no reconstruirlos**. Si Venta Rápida necesita un precio de lista
  por producto, es el primer lugar donde ese campo tendría
  justificación funcional real; agregarlo ahí, no antes.
- Cualquier operación nueva de Fase 3 que escriba un documento +
  postee un asiento debe usar el mismo patrón `tx`/`withTransaction`
  de Fase 1, no dos transacciones separadas.
- El manejo genérico de `P2002` en `errorHandler.js` ya cubre
  cualquier restricción única nueva que Fase 3 agregue (ej. número de
  pedido de venta) — no hace falta traducirlo a mano de nuevo.
- No usar `Dimension` para algo jerárquico ni `FpaDimension` para
  etiquetar movimientos operacionales planos — cada uno tiene su rol ya
  fijado, ver la decisión de no fusión arriba.

### Qué debe recordar Fase 3 (regla de memoria entre fases)

- Los 5 maestros (`Product`/`ProductVariant`/`ProductCategory`/
  `UnitOfMeasure`/`Customer`/`Vendor`) son fuente única, con auditoría
  completa desde esta fase — no crear un segundo catálogo de ninguno.
- `ArApSettings` sigue siendo la única configuración compartida AR/AP.
- Sucursales = `Dimension` tipo `BRANCH`; monedas = `Company.baseCurrency`
  + `ExchangeRate`; no crear modelos `Branch`/`Currency` nuevos sin una
  necesidad real que estos no cubran.
- No fusionar `Dimension`/`FpaDimension` (decisión explícita de esta
  fase, ver arriba).
- Pendientes explícitos, no bloqueantes: precio/costo/impuesto por
  defecto en `Product` (evaluar solo cuando Venta Rápida defina si
  hace falta), unicidad de `taxId`, frontend de Categorías/UOM.

---

## Fase 3 — Ventas, Facturación, Venta Rápida y CxC

**Estado: FASE COMPLETA**

### Objetivo de la fase

Convertir el modelo anterior (Cliente → Factura → Cobro, sin conexión
real con Inventario) en un ciclo comercial completo y opcional:
Pedido → Reserva → Entrega → Inventario → Factura → CxC → Cobro,
manteniendo la venta directa/rápida funcionando con los MISMOS motores
(nunca un segundo motor de facturación/inventario/costo/impuestos).

### Mapa de auditoría inicial (antes de tocar nada)

| Componente | Responsabilidad | Estado encontrado | Decisión |
|---|---|---|---|
| `ArInvoice`/`ArInvoiceLine` | Factura de venta, ya postea vía Fiscal→Ledger | Líneas solo `description`/`quantity`/`unitPrice` — sin relación a producto/inventario (la brecha exacta que señaló Fase 0) | **Extender** |
| `ar-payments.service.recordPayment` | Cobro, aplicación a facturas | Ya sólido, ya con anticipos | **Extender** (método de pago, BCV) |
| `inventory-movements.service.createExit`/`createEntry` | Motor real de salida/entrada con costeo FIFO/LIFO/PMP | Ya sólido, pero **no aceptaba una transacción externa** (`tx`) | **Extender** (agregar `tx` opcional, mismo patrón de Fase 1) |
| `StockLevel.quantityReserved` | Columna ya existía en el schema original de Inventario | **Sin ningún flujo que la gestionara** (la brecha exacta del punto 12) | **Construir el flujo** (`InventoryReservation`), reutilizando la columna existente |
| `SalesOrder`/`SalesDelivery` | — | No existían, ni un equivalente reutilizable | **Crear** |
| `Product`/`Customer`/`Vendor` (Fase 2) | Maestros transversales | Ya listos | **Reutilizar tal cual** |
| `core/ledger.postEntry`, Unit of Work (Fase 1) | Motor de asientos, `tx` opcional | Ya sólido | **Reutilizar tal cual** |
| Métodos de pago | — | No existía ningún catálogo | **Crear**, liviano, en `core/` (transversal) |
| Monedas/BCV | `core/fx` (`ExchangeRate`, `getLatestRate`) | Ya sólido | **Reutilizar tal cual** para el snapshot histórico |

### Regla principal cumplida: un solo motor

Venta Rápida y Venta Completa comparten exactamente los mismos 3
servicios de escritura: `ar-invoices.service.createInvoice`,
`ar-payments.service.recordPayment`, `inventory-movements.service.createExit`.
Ninguno se duplicó. La diferencia entre ambas es solo de UX: Venta
Rápida es una función (`quick-sale.service.js`) que llama a los dos
primeros en secuencia; Venta Completa pasa por `SalesOrder` →
`InventoryReservation` → `SalesDelivery` (que también llama a
`createExit`) → `ArInvoice` (que, cuando la línea ya viene de una
entrega, usa el costo real que esa entrega dejó, sin volver a llamar a
`createExit`).

### Qué se creó

- **Modelos nuevos** (migración `20260923030133_sales_module_orders_reservations_deliveries`,
  aditiva): `SalesOrder`/`SalesOrderLine` (estado comercial propio:
  DRAFT/CONFIRMED/PARTIALLY_DELIVERED/DELIVERED/CANCELLED — nunca
  mezclado con `ArInvoiceStatus`, que no se tocó), `InventoryReservation`
  (RESERVED/PARTIALLY_RELEASED/RELEASED/FULFILLED/CANCELLED, una fila
  por línea de pedido física, `releasedQuantity` acumulada),
  `SalesDelivery`/`SalesDeliveryLine` (DRAFT/CONFIRMED/CANCELLED),
  `PaymentMethod` (catálogo liviano por empresa, se siembra solo con
  Efectivo/Transferencia/Tarjeta/Pago Móvil/Zelle/Binance/Otro).
- **Campos nuevos, todos opcionales/aditivos**: `ArInvoice.salesOrderId`;
  `ArInvoiceLine.productVariantId`/`warehouseId`/`salesOrderLineId`/`discount`/`unitCost`;
  `ArPayment.paymentMethodId`/`foreignCurrency`/`foreignAmount`/`exchangeRate`
  (mismo patrón que `JournalEntryLine.foreignCurrency/foreignDebit/foreignCredit/exchangeRate`,
  no un mecanismo nuevo); `ArCreditNote.relatedInventoryMovementId`
  (enlace opcional a una devolución física registrada aparte, ver
  abajo); `ArApSettings.defaultCustomerId`/`currentSalesOrderNumberSequence`/`currentSalesDeliveryNumberSequence`.
- **Servicios nuevos**: `src/modules/sales/services/` —
  `sales-orders.rules.js` (puras: `calculateLineAmount`,
  `determineOrderStatus`, `remainingToDeliver`, `remainingToInvoice`,
  `averageDeliveredUnitCost`), `sales-orders.service.js`,
  `inventory-reservations.service.js`, `sales-deliveries.service.js`,
  `quick-sale.service.js`. `src/core/payment-methods/payment-methods.service.js`.
- **Rutas nuevas**: `/sales/orders`, `/sales/deliveries`,
  `/sales/quick-sale` (gate `requireModuleAccess('sales')`, agregado a
  `core/rbac/module-access.js` igual que Tesorería/AR/AP/Inventario),
  `/payment-methods` (sin gate de módulo, transversal, mismo criterio
  que `/glossary`/`/notifications`).
- **Frontend**: módulo "Ventas" nuevo (`frontend/src/pages/sales/`):
  `SalesLayout` (3 pestañas), `QuickSalePage` (Venta Rápida — cliente
  opcional vía `EntityAutocomplete`, líneas de producto con
  autocompletado, jurisdicción/cuenta de ingreso preseleccionadas
  solas, cobro opcional en el mismo formulario), `SalesOrdersPage`
  (crear/confirmar/cancelar, detalle de líneas con
  entregado/facturado), `SalesDeliveriesPage` (crear desde un pedido
  confirmado/parcial, confirmar/cancelar). Ítem "Ventas" agregado al
  menú lateral, al Panel principal, y a `config/moduleTabs.js`
  (`SALES_TABS`, `ROUTE_MODULE_KEYS`).

### Qué se extendió (sin duplicar)

- `inventory-movements.service.createExit`/`createBomExit`: ganaron un
  4.º/6.º parámetro `tx` opcional (mismo patrón `withTransaction`/`tx`
  de Fase 1) — necesario para que la salida real de inventario pueda
  coordinarse, dentro de UNA sola transacción, con la Entrega que la
  origina o con la Factura directa que la dispara. `createEntry`/
  `createAdjustment` NO se tocaron (Fase 3 no los necesitaba).
- `ar-invoices.service.createInvoice`: cada línea con `variantId` se
  resuelve (`resolveLine`) en 3 casos — (a) sin producto: exactamente
  igual que antes (texto libre); (b) producto físico con
  `salesOrderLineId` (ya entregado desde un Pedido): usa
  `averageDeliveredUnitCost` de esa línea, **nunca genera una salida
  nueva**; (c) producto físico sin pedido (venta directa/rápida):
  dispara `createExit(tx)` DENTRO de la misma transacción de la
  factura, justo después de crearla (para poder referenciarla), y
  actualiza el `unitCost` de la línea — el objeto devuelto se relee una
  vez más dentro de la misma transacción para que la respuesta nunca
  quede con un `unitCost` desactualizado (bug real encontrado y
  corregido durante la verificación, ver abajo). Un producto de
  servicio (`isService: true`) nunca entra en (b)/(c).
- `ar-payments.service.recordPayment`: ganó resolución de método de
  pago (opcional) y de monto en moneda extranjera (`foreignCurrency`/
  `foreignAmount` → resuelve la tasa vigente con `core/fx.getLatestRate`
  UNA vez y la guarda como snapshot — nunca se recalcula después);
  ganó `applyFullyToInvoiceId` (aplica lo cobrado a una factura
  puntual hasta donde alcance, reutilizando la MISMA función pura
  `applyPaymentToInvoices` de siempre) — lo usa Venta Rápida para no
  tener que conocer de antemano el monto exacto cuando viene de una
  conversión BCV.
- `core/ar-ap-settings/ar-ap-settings.service.js`: ganó
  `getNextSalesOrderNumber`/`getNextSalesDeliveryNumber` (mismo patrón
  atómico que ya usaban facturas/notas) y `resolveDefaultCustomerId`
  ("Consumidor Final", punto 22 — nunca se asume, solo si la empresa lo
  configuró explícitamente).
- `core/rbac/module-access.js`/`role.service.js`: nueva entrada `sales`
  (mismo nivel que Tesorería/AR/AP/Inventario: `ADMIN`/`COLLABORATOR`).

### Qué se fusionó / eliminó

Nada — no había ningún `Sales*` ni motor de facturación/inventario
paralelo que fusionar (confirmado en la auditoría inicial).

### Devoluciones y Notas de Crédito (punto 28-29) — alcance recortado a propósito

`ArCreditNote` YA era, por diseño previo, un ajuste puramente
financiero (nunca tocaba inventario) — eso YA cumplía "no asumir que
una nota de crédito implica devolución física" sin cambiar nada. Se
agregó `relatedInventoryMovementId` (opcional, único) para que,
**cuando sí ocurre** una devolución física, se pueda enlazar con el
movimiento de entrada real (registrado por separado, reutilizando
`POST /inventory/movements/entries` ya existente — nunca un segundo
motor de entrada). El flujo completo pedido en el punto 29
(Recepción física → Inspección → Inventario disponible/defectuoso) NO
se implementó: el modelo de Inventario no tiene hoy ningún concepto de
"stock defectuoso" separado del disponible, y construirlo habría sido
un cambio de Inventario mucho más grande que "la integración mínima
necesaria" que pide la sección 40 del prompt. Documentado como
pendiente explícito, no como incompleto.

### Métodos de pago y BCV (puntos 23-24)

Alarfly solo REGISTRA los métodos (Efectivo/Transferencia/Tarjeta/Pago
Móvil/Zelle/Binance/Otro) — cero integración de procesamiento externo,
tal como se pidió explícitamente. El cobro en Bs. reutiliza
`core/fx.getLatestRate` (ya existente, usado por la revaluación
cambiaria de Contabilidad) para resolver la tasa vigente una sola vez;
el snapshot (`foreignCurrency`/`foreignAmount`/`exchangeRate`) se
guarda en el propio `ArPayment`, igual patrón que `JournalEntryLine`
ya usaba para sus líneas en moneda extranjera — verificado con una
prueba de integración real que una tasa BCV nueva después NO recalcula
un cobro histórico.

### Bugs reales encontrados y corregidos durante la verificación

1. **`createInvoice` devolvía `unitCost: null`** en la línea recién
   creada de una venta directa/rápida, aunque el valor correcto (10)
   ya estaba guardado en la base de datos — el objeto de respuesta se
   armaba ANTES de que `createExit` completara la actualización de esa
   línea. Corregido releyendo la factura una vez más dentro de la
   misma transacción cuando hubo al menos una línea de salida directa.
   Confirmado con `curl` contra Postgres real (antes: `null`; después:
   `"10"`) y con una prueba de integración dedicada.
2. **Pantallas de Pedidos y Entregas se quedaban en blanco (pantalla
   negra) apenas había al menos una fila** — `formatDate(order.orderDate)`
   recibía la fecha como texto (JSON no tiene tipo `Date`) en vez de
   `new Date(order.orderDate)`, y `Intl.DateTimeFormat.format()` con un
   string no numérico lanza `RangeError: Invalid time value` en tiempo
   de render, tumbando el árbol de React. El resto del proyecto SIEMPRE
   envuelve la fecha con `new Date(...)` antes de `formatDate` (patrón
   confirmado en `ArInvoicesPage`/`PurchaseOrdersPage`) — se corrigió
   igual acá. Encontrado con Playwright real (2 errores de consola
   "Invalid time value" + capturas de pantalla completamente negras),
   confirmado corregido con una nueva corrida mostrando los datos
   reales (pedido "Cliente Fase3 E2E" con estado "Entregado
   parcialmente", entrega N.º 1 "Confirmada").

### Atomicidad, duplicación, aislamiento (puntos 31/42-44)

Todas las operaciones críticas de esta fase usan el patrón `tx`/
`withTransaction` de Fase 1 — ninguna abre una segunda transacción
dentro del mismo flujo. Confirmado con pruebas de integración reales
(no solo revisión de código):

- **Atomicidad** (punto 42): forzado un fallo DESPUÉS de que
  `createExit` ya generó la salida real, tanto dentro de
  `confirmDelivery` como dentro de `createInvoice` — en ambos casos,
  el rollback completo se verificó (sin movimiento, sin ajuste de
  `quantityReserved`/`quantityOnHand`, sin factura/entrega a medias,
  sin auditoría falsa de éxito).
- **Duplicación** (punto 43): confirmar la misma entrega dos veces
  rechaza la segunda (`SALES_DELIVERY_NOT_DRAFT`) sin generar un
  segundo movimiento de inventario — verificado contando movimientos
  reales antes/después.
- **Aislamiento por empresa** (punto 44): un pedido de la Empresa A no
  puede usar un cliente o una variante de producto de la Empresa B —
  verificado con dos escenarios reales simultáneos.

### Reserva vs. salida (puntos 12-13/45) y servicios (punto 11/46)

Verificado con pruebas de integración reales: confirmar un pedido
mueve solo `quantityReserved` (el físico NO cambia); confirmar una
entrega SÍ mueve `quantityOnHand` (y libera la reserva
correspondiente). Una línea de servicio nunca genera
`InventoryReservation` ni `InventoryMovement`, ni al confirmar el
pedido ni al facturarla directo.

### Tests y resultado

91 suites, 565 tests, todos en verde (535 preexistentes de Fases 1-2 +
30 nuevos de esta fase: 10 reglas puras, 10 de integración Pedido→
Reserva→Entrega —incluida la prueba de atomicidad con rollback
forzado—, 4 de Venta Rápida/BCV, 6 de la extensión de facturación).
Todas las pruebas de integración corren contra Postgres real (mismo
criterio que Fase 1), con fixtures nuevos (`buildSalesScenario`,
`createPhysicalProduct` usando el motor de valoración real —nunca
insertando `StockLevel` a mano—, `createServiceProduct`) agregados a
`test-helpers/integration-fixtures.js`, y `cleanupCompany` ampliado
para las tablas nuevas de Ventas/Inventario, respetando el orden de
FKs. `eslint` (backend) y `oxlint`/`build` (frontend) sin advertencias
nuevas. Verificado además a mano contra Postgres real con `curl` (login
real, Venta Rápida completa con producto físico + pago, ciclo
Pedido→Confirmar→Entregar parcial→Facturar) y con Playwright real
(las 3 pantallas de Ventas navegadas, autocompletado de producto
probado, 0 errores de consola tras los 2 fixes).

### Riesgos

- Ninguno nuevo más allá de los ya documentados en Fase 1 (TOCTOU de
  período, `reverseMatch` sin revertir saldo, crons sin `lastRunAt`).
- Una entrega ya `CONFIRMED` no se puede cancelar (ya generó una
  salida real y permanente) — mismo criterio que el resto de
  Inventario, documentado explícitamente en el mensaje de error
  (`SALES_DELIVERY_ALREADY_CONFIRMED`), no es un bug.

### Pendientes documentados (no bloqueantes)

1. Inspección/stock defectuoso en devoluciones físicas (punto 29) —
   requiere un cambio de modelo de Inventario más grande, fuera de la
   integración mínima de esta fase.
2. Precio de lista por defecto en `Product` — seguía sin consumidor
   real (Venta Rápida/Completa toman `unitPrice` manual por línea,
   igual que ya hacía AR); Fase 2 ya lo documentó como pendiente
   condicionado a que Ventas lo necesitara, y en la práctica no lo
   necesitó (el flujo de "5 interacciones" funciona bien sin él,
   verificado con Playwright).
3. Frontend de Pedidos/Entregas es funcional pero deliberadamente
   liviano (`<select>` simples para almacén, sin el mismo nivel de
   pulido que `ArInvoicesPage` — sin `RecordDrawer`/`QuickCreateModal`/
   `DocumentActionsMenu`) — recorte de alcance consciente para poder
   cubrir el backend completo (el corazón de lo pedido en esta fase)
   dentro del tiempo disponible.
4. Todos los pendientes ya heredados de Fase 1/2.

### Qué debe recordar Fase 4

**Heredado de Fase 1** (sin tocar, seguir usando): Unit of Work
(`withTransaction`), `postEntry(data, tx)`, patrón de auditoría dentro
de la misma transacción, idempotencia por co-localización atómica.

**Heredado de Fase 2** (sin tocar, seguir usando): `Product`/
`ProductVariant`/`Customer`/`Vendor`/`ProductCategory`/`UnitOfMeasure`
como maestros únicos; `Dimension` (BRANCH) para sucursales;
`Company.baseCurrency`+`ExchangeRate` para monedas; NO fusionar
`Dimension`/`FpaDimension`.

**Construido en Fase 3** (reutilizar, no reconstruir):
`SalesOrder`/`SalesOrderLine`/`InventoryReservation`/`SalesDelivery`/
`SalesDeliveryLine` (ciclo comercial completo); `inventory-movements.service.createExit(...,tx)`/`createBomExit(...,tx)`
ya aceptan transacción externa — cualquier operación de Compras que
necesite lo mismo (`GoodsReceipt`) debe extender `createEntry` con el
mismo patrón, no reimplementar; `PaymentMethod` (core, catálogo
liviano); snapshot BCV en `ArPayment` (`foreignCurrency`/
`foreignAmount`/`exchangeRate`); `ArApSettings.defaultCustomerId`
("Consumidor Final"); `ar-invoices.service.resolveLine` es el único
lugar que decide si una línea de factura dispara inventario — Compras
NO debe inventar su propia versión de esta lógica para facturas de
proveedor, sino seguir el mismo criterio si alguna vez lo necesita.

**Lo que NO debe reconstruirse**: un segundo motor de facturación, de
inventario, de costeo, de impuestos o de cobros — los 3 puntos de
escritura (`createInvoice`, `recordPayment`, `createExit`) siguen
siendo los únicos, tal como exigía la regla principal de esta fase.
`ApPayment`/`PaymentOrder`/`ArPayment`/`Debt` siguen sin unificarse
(pendiente heredado de Fase 1, no tocado en esta fase, fuera de su
alcance explícito — sección 40 de este prompt tampoco lo pedía).

## Fase 4 — Compras, Inventario y Cuentas por Pagar

**Estado: FASE COMPLETA**

### Objetivo de la fase

Construir el equivalente OPERATIVO de Ventas del lado de compras:
Proveedor → Orden de Compra → Recepción → Inventario → Factura de
Proveedor → CxP → Pago → Tesorería → Ledger → Auditoría, reutilizando
sin duplicar los mismos maestros, el Ledger, la Auditoría, el Unit of
Work, el motor de Inventario, FX, la separación de estados y el patrón
de reversión ya construidos en Fases 1-3.

### Mapa de auditoría inicial (antes de tocar nada)

| Componente | Responsabilidad | Estado encontrado | Decisión |
|---|---|---|---|
| `PurchaseOrder`/`PurchaseOrderLine` (`modules/inventory`, punto 5 de Inventario, ya existía desde antes de esta fase) | Ciclo de compra completo EN UN SOLO documento (DRAFT→SUBMITTED→PARTIALLY_RECEIVED→RECEIVED→CANCELLED) — a diferencia de Ventas, nunca separó intención de hecho físico en 2 documentos | Funcional pero con 2 huecos reales (ver abajo) | **Extender**, no crear un `GoodsReceipt` — la separación en 2 documentos que sí necesitó Ventas no aplica acá porque Compras nunca se construyó así |
| `purchase-orders.service.receivePurchaseOrder` | Recibir mercancía, generar la entrada real de inventario | **Bug real de atomicidad**: llamaba a `createEntry` (transacción propia por línea, sin `tx` externo) y dejaba el resto de las escrituras (`quantityReceived`, estado de la orden, auditoría) fuera de esa transacción — un fallo a mitad de camino podía dejar inventario movido sin que la orden lo reflejara | **Extender**: `createEntry(...,tx)` con el mismo patrón que ya usa `createExit`/`createBomExit`, y envolver TODO `receivePurchaseOrder` en una sola transacción |
| `PurchaseOrderLine` | Cantidad recibida | Solo `quantityReceived`; el costo REAL recibido nunca se guardaba (`unitCost` es apenas el estimado, nunca se sobreescribe) — sin equivalente de `SalesOrderLine.deliveredCostTotal` | **Extender**: `receivedCostTotal`/`billedQuantity` nuevos, espejo exacto de `deliveredCostTotal`/`invoicedQuantity` |
| `ApBill`/`ApBillLine` | Factura de compra | Línea de gasto pura (sin producto/variante/almacén/costo) — exactamente el punto de partida que tenía `ArInvoiceLine` antes de Fase 3 | **Extender**: mismo patrón `resolveLine` de 3 casos que ya usa AR |
| `ApPayment` | Pago a proveedor | Sin método de pago ni snapshot BCV, a diferencia de `ArPayment` | **Extender**: mismo patrón que Fase 3 le dio a `ArPayment` |
| Nota de crédito/débito a proveedor | — | No existía ningún modelo AP-side (`ArCreditNote` no tiene mirror) | **Crear** `ApCreditNote`, espejo de `ArCreditNote` |
| `PaymentOrder.vendorId`/`createPaymentOrderForVendorBills`/`PaymentOrderBillApplication` (Tesorería↔AP) | Flujo de aprobación multinivel para pagar facturas de AP | Ya construido y funcionando de una sesión anterior | **Reutilizar tal cual, no tocar** (sección 22 del prompt lo prohibía explícitamente) |
| `Vendor` | Maestro de proveedores | Ya sólido (Fase 2) | **Reutilizar tal cual** |
| `core/rbac/module-access.js` | Gate de `accounts-payable`/`inventory` | Ya en `['ADMIN','COLLABORATOR']`, mismo nivel que `sales` | **Reutilizar tal cual**, sin cambios |

### Regla principal cumplida: reutilizar, no duplicar

Ningún motor nuevo. Compras sigue usando exactamente `core/ledger.postEntry`,
`fiscal-transactions.service.createFiscalTransaction`,
`inventory-movements.service.createEntry`/`createExit`,
`core/audit.log`, `core/fx.getLatestRate`, `core/database/unit-of-work.withTransaction`
y `PaymentOrder` — los mismos que ya usaban Contabilidad/Fiscal/Inventario/
Ventas/AR. Lo único genuinamente nuevo es el modelo `ApCreditNote` (no
existía ningún equivalente AP-side) y la extensión aditiva de 4 modelos
ya existentes.

### Qué se creó

- **Modelo nuevo** (migraciones `20260923181403_purchases_ap_extension`
  y `20260923181507_purchase_order_line_billed_quantity`, ambas
  aditivas): `ApCreditNote`/`ApCreditNoteType` — espejo exacto de
  `ArCreditNote`, con una pieza que `ArCreditNote` dejó sin conectar en
  ningún flujo real desde que se construyó (`relatedInventoryMovementId`
  nunca se usaba desde ningún servicio, confirmado por `grep`): acá SÍ
  se conecta de verdad — una devolución física a proveedor genera una
  salida real de inventario (`VENDOR_RETURN_EXIT`, nuevo valor del enum
  `InventoryMovementType`, vía `inventory-movements.service.createExit`,
  nunca reimplementado) y se liga con el campo.
- **Campos nuevos, todos aditivos**: `PurchaseOrderLine.receivedCostTotal`/`billedQuantity`
  (espejo de `SalesOrderLine.deliveredCostTotal`/`invoicedQuantity`);
  `InventoryMovement.purchaseOrderLineId` (opcional, 1 a muchos — a
  diferencia de `SalesDeliveryLine.inventoryMovementId`, que es 1 a 1,
  una línea de orden de compra puede recibirse en varias entregas
  parciales, cada una con su propio movimiento real, así que la
  trazabilidad es "el movimiento apunta a la línea", no al revés);
  `ApBillLine.productVariantId`/`warehouseId`/`purchaseOrderLineId`/`discount`/`unitCost`
  (espejo exacto de la extensión de `ArInvoiceLine` en Fase 3);
  `ApPayment.paymentMethodId`/`foreignCurrency`/`foreignAmount`/`exchangeRate`
  (espejo exacto de `ArPayment`); `ArApSettings.currentApCreditNoteNumberSequence`
  (+ `getNextApCreditNoteNumber(companyId, tx)`, mismo patrón atómico
  que las 4 numeraciones ya existentes).
- **Servicios nuevos**: `accounts-payable/services/ap-credit-notes.rules.js`
  (`applyCreditNoteToBill`, espejo de `applyCreditNoteToInvoice`) y
  `ap-credit-notes.service.js` (`createCreditNote`/`getCreditNote`/`listCreditNotes`).
- **Rutas nuevas**: `POST/GET /accounts-payable/credit-notes` (mismo
  gate `requireModuleAccess('accounts-payable')`, `requireRole('ADMIN','COLLABORATOR')`
  para crear — sin RBAC nuevo, reutiliza el ya existente).
- **Frontend**: `ApCreditNotesPage.jsx` nuevo (formulario con casilla
  opcional "¿Hubo devolución física?" que revela producto/almacén/
  cantidad vía `EntityAutocomplete`), pestaña "Notas a Proveedores"
  agregada a `AR_AP_TABS`/`App.jsx`; `apCreditNotesApi` en `api/ap.js`.

### Qué se extendió (sin duplicar)

- **`inventory-movements.service.createEntry`**: ganó un 4.º parámetro
  `tx` opcional, exactamente el mismo patrón `withTransaction(work, tx)`
  que Fase 3 ya le había dado a `createExit`/`createBomExit` —
  `purchase-orders.service.receivePurchaseOrder` y
  `ap-bills.service.createBill` (compra directa) ahora lo pasan.
- **`purchase-orders.service.receivePurchaseOrder`**: reescrito para
  quedar completamente atómico — TODO (cada entrada real de inventario
  por línea recibida, el acumulado `quantityReceived`/`receivedCostTotal`
  de cada línea, el nuevo estado de la orden, la auditoría) queda ahora
  en una sola transacción vía `withTransaction`. Antes de esta fase,
  `createEntry` abría su propia transacción independiente por cada
  línea del lote de recepción y el resto de las escrituras quedaban
  sueltas — un fallo a mitad de camino podía dejar inventario movido
  sin que la orden lo reflejara (o viceversa). Verificado con una
  prueba de integración que fuerza el fallo justo después de la segunda
  entrada real y confirma que absolutamente nada queda aplicado.
- **`purchase-orders.rules.js`**: ganó `averageReceivedUnitCost` (espejo
  exacto de `averageDeliveredUnitCost` de Ventas) y `remainingToBill`
  (espejo de `remainingToInvoice`) — funciones puras, sin acceso a base
  de datos, igual criterio que el resto del proyecto.
- **`ap-bills.service.createBill`**: ganó `resolveLine`, espejo
  estructural exacto de `ar-invoices.service.resolveLine` — 3 casos: (a)
  sin `variantId`: línea de texto de siempre, sin cambios; (b) con
  `variantId` de un servicio: se factura igual, nunca toca inventario;
  (c) con `variantId` de un producto físico: (c1) con
  `purchaseOrderLineId` — la mercancía YA se recibió, usa
  `averageReceivedUnitCost` y valida `remainingToBill`, **nunca genera
  un segundo movimiento de inventario**, solo incrementa `billedQuantity`;
  (c2) sin `purchaseOrderLineId` (compra directa) — SÍ genera una
  entrada real de inventario dentro de la misma transacción de la
  factura, mismo patrón `needsDirectExit`→`needsDirectEntry` que ya usa
  AR.
- **`ap-payments.service.recordPayment`**: ganó `resolvePaymentMethod`/
  `resolveForeignAmount`, copiados literalmente del mismo patrón de
  `ar-payments.service.js` (snapshot BCV histórico vía
  `core/fx.getLatestRate`, nunca recalculado después). AP sigue sin
  admitir anticipos (`applyPaymentToBills` sigue exigiendo suma exacta,
  sin cambios) — a diferencia de AR, no se le agregó una rama de "cobro
  ligado a un movimiento bancario real", porque no era parte del
  alcance pedido para esta pieza (método + BCV, nada más).
- **`ap-bills.service.js`/`ap-payments.service.js`**: `createBill`
  ganó un 4.º parámetro `tx` opcional (mismo patrón de composabilidad
  ya usado en `ar-invoices.service.createInvoice`), aunque ningún
  llamador lo necesita todavía — queda listo si aparece uno.

### El diseño contable de la compra directa (sin orden previa) — la pieza más delicada de esta fase

`ApBill.expenseAccountId` es una sola cuenta por FACTURA completa (no
por línea, simplificación ya documentada desde que AP se construyó). El
motor fiscal (`createFiscalTransaction`) siempre postea débito
`expenseAccountId` / crédito Cuentas por Pagar por el subtotal completo
— eso es correcto para líneas de gasto/servicio, pero comprar
INVENTARIO no debería debitar una cuenta de gasto/P&L, sino un activo.
Se resolvió así, sin inventar ninguna cuenta nueva ni pedirle una al
usuario: cuando una línea de compra directa (sin orden) genera su
propia entrada real de inventario, esa entrada usa `expenseAccountId`
como su propia contraparte (débito Inventario / crédito
`expenseAccountId`) — el débito que el motor fiscal ya había hecho a
`expenseAccountId` por esa porción queda neteado exactamente a cero por
el crédito de la entrada de inventario, y el efecto COMBINADO de las
dos transacciones (fiscal + entrada) termina siendo el correcto: débito
Inventario, crédito Cuentas por Pagar. `expenseAccountId` actúa de
pasarela/wash account, nunca queda con saldo residual. Verificado con
una prueba de integración que suma los `JournalEntryLine` de ambas
transacciones agrupados por cuenta y confirma el neteo exacto (débito
Inventario = 300, crédito Cuentas por Pagar = 300, `expenseAccountId`
neto = 0, para una compra de 20 unidades a 15).

Para una línea que SÍ referencia una `purchaseOrderLineId` ya recibida,
no se genera ningún segundo movimiento ni segunda cuenta — la
recepción ya dejó su propio efecto contable real en el momento en que
ocurrió (vía el `counterpartyAccountId` que el receptor eligió en ese
momento, ej. Cuentas por Pagar directamente o una cuenta puente de
"mercancía por facturar", según lo que la empresa use). La factura para
esa porción es puramente documental/de trazabilidad de CxP (costo real,
vencimiento, aplicación de pagos) — nunca vuelve a mover inventario ni
a inventar un segundo asiento para el mismo hecho físico.

### Devolución a proveedor (punto 29 — integración mínima)

Interpretación explícita (documentada, no confirmada con el usuario, en
`prisma/schema.prisma`): una devolución física a proveedor es una
salida real de inventario (`VENDOR_RETURN_EXIT`, nunca `SALE_EXIT` ni
`ADJUSTMENT_DECREASE` — tiene una nota de crédito de proveedor detrás,
no es una venta ni un ajuste sin causa), generada vía
`inventory-movements.createExit` (mismo motor de siempre, nunca
reimplementado) desde `ap-credit-notes.service.createCreditNote` cuando
el llamador indica `physicalReturn: {productVariantId, warehouseId,
quantity}`. Igual que AR, la nota es opcionalmente ligada
(`relatedInventoryMovementId`), nunca obligatoria — la mayoría de las
notas (descuentos, cargos adicionales) no tienen devolución física
real. No se construyó ningún flujo de inspección/calidad ni un estado
de "stock defectuoso" separado del disponible — mismo límite consciente
ya documentado en Fase 3 para el lado de Ventas, misma razón (habría
sido un cambio de modelo de Inventario mucho más grande que la
integración mínima pedida).

### Bugs reales encontrados y corregidos durante la auditoría (antes de escribir código, no durante pruebas)

1. **`receivePurchaseOrder` no era atómica** (ver arriba, "Qué se
   extendió") — encontrado leyendo el código real antes de diseñar
   nada, confirmado con una prueba de integración dedicada (rollback
   forzado con `jest.spyOn` después de la segunda entrada real: cero
   movimientos, cero cambios en `quantityReceived`, la orden se queda
   en `SUBMITTED`, no en `PARTIALLY_RECEIVED` a medias).
2. **`PurchaseOrderLine` no tenía forma de recordar el costo REAL
   recibido** — `unitCost` es solo el estimado inicial, nunca se
   sobreescribía en la recepción; sin esto, facturar contra una línea
   recibida no habría tenido de dónde sacar un costo real (mismo hueco
   que tenía `ArInvoiceLine` antes de que Fase 3 agregara
   `deliveredCostTotal`). Corregido con `receivedCostTotal` +
   `averageReceivedUnitCost`, mismo patrón exacto.

### Atomicidad, costos, duplicación, sobre-recepción, producto vs. servicio, BCV, aislamiento (14 pruebas de integración nuevas, todas contra Postgres real)

- **Atomicidad**: recepción con fallo forzado después de la segunda
  entrada real → rollback total confirmado (cero movimientos, cero
  cambios en la orden).
- **Costos**: dos recepciones parciales a costos distintos (10 y 12)
  acumulan `receivedCostTotal` exacto (600+480=1080) y
  `averageReceivedUnitCost` correcto al facturar (16, para una
  recepción de 20 a costo 16 en un escenario separado).
- **Duplicación**: facturar la misma línea recibida en dos facturas
  parciales que suman exactamente lo recibido deja `billedQuantity`
  correcto; un tercer intento sin saldo se rechaza; facturar contra una
  línea ya recibida NUNCA genera un segundo `InventoryMovement`
  (verificado contando movimientos antes/después).
- **Sobre-recepción**: recibir más de lo pedido se permite, se reporta
  como discrepancia (`hasDiscrepancy: true`, `discrepancy: "5.0000"`) y
  NO bloquea — mismo criterio ya documentado ("una recepción parcial,
  o incluso una sobre-recepción, es normal en la práctica").
- **Producto vs. servicio**: una línea de servicio nunca genera
  movimiento, nunca pide almacén, `unitCost` queda `null`.
- **BCV**: pago con `foreignCurrency`/`foreignAmount` deriva el monto
  base correcto de la tasa vigente y el `exchangeRate` queda como
  snapshot histórico.
- **Aislamiento por empresa**: una factura o una orden de compra de la
  Empresa A son invisibles (`404`) para la Empresa B.
- Además: AP sin anticipos (suma aplicada debe ser exacta), devolución
  física real con `VENDOR_RETURN_EXIT` ligado, nota sin devolución
  física no toca inventario, numeración de notas atómica sin colisión.

Fixtures nuevos en `test-helpers/integration-fixtures.js`:
`createVendor`, `setPayableAccount`, `buildPurchaseScenario` (espejo de
`buildSalesScenario`, producto físico SIN stock inicial — Compras es
quien lo genera recibiendo). `cleanupCompany` ampliado con las tablas
nuevas de AP/Compras, respetando el orden de FKs (`ApCreditNote`/
`ApPaymentApplication`/`ApPayment`/`ApBillLine`/`ApBill` antes que
`Vendor`, porque `vendorId` es `RESTRICT` en ambos lados;
`PurchaseOrderLine`/`PurchaseOrder` también antes que `Vendor` por el
mismo motivo).

### Tests y resultado

92 suites, 579 tests, todos en verde (565 preexistentes de Fases 1-3 +
14 nuevos de esta fase, todos de integración contra Postgres real — no
se necesitaron reglas puras nuevas más allá de las 2 funciones agregadas
a `purchase-orders.rules.js`, ya cubiertas por los propios tests de
integración). `eslint` (backend) sin advertencias nuevas. `npx prisma
validate`/`format` sin errores. Verificado además de punta a punta con
`curl` real (crear→enviar→recibir una orden de compra, facturar contra
ella, pagar, emitir nota con devolución física — 11 escenarios
adicionales corridos a mano antes de formalizar los tests) y con
Playwright real contra los dos servidores (formulario de Facturas de
Compra con el nuevo selector "Facturar desde una orden de compra ya
recibida" leyendo datos reales — 30 unidades recibidas sin facturar
mostradas correctamente —, factura creada con el monto exacto 255 y
`billedQuantity` actualizado a 30 confirmado contra la base de datos
real después del click; 0 errores de consola nuevos, aparte del
bloqueo ya conocido de Google Fonts en el entorno de pruebas).

### Riesgos

- Ninguno nuevo más allá de los ya documentados en Fases 1-3.
- El diseño de "compra directa neteando `expenseAccountId` a cero" (ver
  arriba) depende de que `expenseAccountId` de una factura con líneas
  físicas directas sea una cuenta que el usuario pueda tolerar ver
  transitar por un asiento intermedio (nunca le queda saldo, pero si
  alguien mira el detalle de esa cuenta verá 2 líneas por esa factura
  en vez de una) — documentado acá para que no se interprete como un
  error contable si aparece en un reporte de auditoría del mayor.

### Pendientes documentados (no bloqueantes)

1. Inspección/calidad/stock defectuoso en devoluciones a proveedor
   (punto 29) — mismo límite ya documentado en Fase 3 para el lado de
   Ventas.
2. `ApPayment` no admite pago ligado a un movimiento bancario real
   (`bankTransactionId`), a diferencia de `ArPayment` — no era parte
   del alcance pedido ("método + BCV"); se puede agregar más adelante
   reutilizando el mismo patrón que ya tiene AR.
3. Frontend de Facturas de Compra es funcional pero deliberadamente
   proporcional: el selector de línea manual usa `EntityAutocomplete` +
   `<select>` de almacén (igual nivel que `SalesOrdersPage`), sin
   `RecordDrawer`/`DocumentActionsMenu` en esta pieza nueva — mismo
   criterio de recorte consciente que ya se documentó en Fase 3.
4. Todos los pendientes ya heredados de Fases 1-3 (unificación de
   `PaymentOrder`/`ApPayment`/`ArPayment`/`Debt`, `reverseMatch` sin
   revertir saldo, TOCTOU de período, crons sin `lastRunAt`).

### Qué debe recordar Fase 5

**Heredado de Fases 1-3** (sin tocar, seguir usando): Unit of Work
(`withTransaction`), `postEntry(data, tx)`, `core/audit.log(data, tx)`,
`core/fx.getLatestRate`/snapshot BCV, `PaymentMethod` (core), los 5
puntos de escritura reales del proyecto (`postEntry`, `createInvoice`,
`createBill`, `recordPayment` ×2, `createExit`/`createEntry`) — ninguno
se duplicó.

**Construido en Fase 4** (reutilizar, no reconstruir):
`purchase-orders.service.{createPurchaseOrder,submitPurchaseOrder,receivePurchaseOrder,cancelPurchaseOrder}`
(ciclo completo, `receivePurchaseOrder` ahora atómico);
`inventory-movements.service.createEntry(...,tx)` ya acepta transacción
externa, igual que `createExit`/`createBomExit` — cualquier operación
futura que necesite una entrada de inventario coordinada con otra
escritura debe extender/reutilizar esto, no reimplementar;
`ap-bills.service.resolveLine`/`ap-payments.service.resolveForeignAmount`/`resolvePaymentMethod`
son los únicos lugares que deciden si una línea de factura de compra
toca inventario o cómo se resuelve una moneda extranjera —
`ApCreditNote`/`ap-credit-notes.service.createCreditNote` es el único
lugar que genera una devolución física a proveedor
(`VENDOR_RETURN_EXIT`). `PurchaseOrderLine.receivedCostTotal`/
`billedQuantity` son la única fuente de costo real recibido/facturado
— nunca recalcular esto en otro lugar.

**Lo que NO debe reconstruirse**: un segundo motor de recepción, de
facturación de compra, de costeo, o de aprobación de pagos —
`PaymentOrder.vendorId`/`createPaymentOrderForVendorBills` (Tesorería↔AP)
ya existía completo antes de esta fase y NO se tocó, tal como exigía la
sección 22 del prompt. `ApPayment`/`PaymentOrder`/`ArPayment`/`Debt`
siguen sin unificarse (mismo pendiente heredado de Fase 1, fuera de
alcance otra vez).

## Fase 5 — Finanzas Integradas y Simplificadas

### Objetivo de la fase

Convertir la experiencia financiera fragmentada de Alarfly (Tesorería/
Contabilidad/CxC/CxP/pagos/cobros/deuda/liquidez/conciliación, cada
una en su propio módulo técnico) en una experiencia integrada,
comprensible y orientada a decisiones bajo un solo paraguas
"Finanzas" — **sin eliminar** los módulos técnicos subyacentes
(Tesorería/Contabilidad/AR/AP/FP&A/Ledger siguen existiendo y siguen
siendo accesibles tal cual). Regla explícita del prompt: no crear una
segunda "capa financiera" paralela (ni un segundo Ledger, ni un
segundo motor de pagos/tesorería/CxC/CxP/deuda/liquidez) — Fase 5 es
sobre todo una capa de integración/orquestación/simplificación.

### Mapa de auditoría inicial (antes de tocar nada)

Auditados exhaustivamente antes de escribir código: Tesorería (9
puntos, incluido el pendiente heredado de `reverseMatch` sin revertir
saldo), Contabilidad (Ledger, periodos, dimensiones), CxC/AR (facturas,
cobros, notas, cobranza escalonada), CxP/AP (facturas, pagos, notas),
Financiamiento (`Debt`/`DebtInstallment`/`DebtMovement`), FX
(`Company.baseCurrency`/`ExchangeRate`/snapshot BCV), Auditoría
(`core/audit`), RBAC (`core/rbac/module-access.js`), y el frontend
(layouts, rutas, componentes reutilizables existentes:
`ModuleBreadcrumb`, `moduleTabs.js`, `StatCard`, `AgingPage`,
`CashPositionPage`, `LiquidityForecastPage`, `DebtsPage`).

Hallazgo central de la auditoría (sección 40 del prompt): la única
"capa de lectura consolidada" que ya existía en el proyecto era
`core/glossary/glossary.service.js`, que **invertía la dirección de
dependencia correcta** — importaba directo `modules/fpa`,
`modules/treasury` y `modules/accounts-receivable` (y para
`accounts-payable` ni siquiera reutilizaba un servicio: hacía su
propia consulta Prisma duplicada, `getAccountsPayableTotal`, ad hoc
dentro del propio glosario). El patrón correcto, que ya usa
`modules/reports` como precedente real en el proyecto, es
`Módulos operativos → Capa de lectura/consolidación → Finanzas/
Dashboard/Analítica` — nunca al revés, y la capa consolidada nunca
debe convertirse en una segunda fuente de verdad.

Segundo hallazgo real (sección 11 del prompt, pendiente heredado
documentado desde Fase 1): `reconciliation.service.reverseMatch`
desemparejaba un movimiento bancario pero **nunca revertía el ajuste
de saldo** que sí se había hecho al conciliar — un bug real de
integridad de datos, no solo una limitación documentada. Se decidió
corregirlo en Fase 5 (autorizado explícitamente por la sección 11 del
prompt: "revisar y decidir si corresponde resolverlo").

### Regla principal cumplida: reutilizar, no duplicar

No se creó ningún motor nuevo de pagos, cobros, deuda o liquidez.
Todo lo que ya existía (`ar-payments.service`, `ap-payments.service`,
`payment-orders.service`, `debts.service`, `liquidity-forecast.service`,
`payment-calendar.service`, `aging.service`) se **reutiliza tal cual**,
tanto en el backend (la nueva `modules/finance` solo LEE, nunca
escribe) como en el frontend (las pantallas de Finanzas son en su
mayoría el mismo componente React ya existente, montado bajo una ruta
nueva — cero componentes duplicados).

Confirmado en la propia auditoría (sección 15 del prompt): la
distinción Workflow vs. Ejecución vs. Conciliación de `PaymentOrder`
**ya existe de forma natural** en el enum `PaymentOrderStatus`
(DRAFT/PENDING_APPROVAL = workflow; APPROVED = ejecución, el asiento
ya se posteó y el dinero ya salió; PAID, puesto solo por
`payment-batches.service`, es una confirmación administrativa
posterior separada) — no hizo falta ningún enum nuevo.

### Qué se creó

- **`ReconciliationMatch.generatedNewEntry`** (campo nuevo, migración
  `20260923184448_finance_reconciliation_match_fix`): distingue el
  único caso (`matchWithNewEntry`) donde un emparejamiento generó su
  propio asiento y tocó `TreasuryAccount.currentBalance`, de los dos
  casos (`runAutomaticMatching`/`manualMatch`) que solo emparejan
  contra un asiento ya existente y nunca tocan el saldo.
- **`reconciliation.service.reverseMatch` reescrito, atómico**: una
  sola transacción; bloqueo de doble reversión con una `updateMany`
  condicional (`WHERE status = 'ACTIVE'`) verificando `count` — nunca
  lectura-luego-escritura, para que dos reversiones concurrentes del
  mismo match no puedan colarse ambas; si `generatedNewEntry`, reversa
  el asiento (vía `core/ledger.reverseEntry`, ahora con parámetro `tx`
  opcional) Y ajusta `currentBalance` exactamente en la dirección
  opuesta a como se ajustó al conciliar; si no, solo desempareja
  (comportamiento sin cambios).
- **`core/ledger.reverseEntry(..., tx = null)`**: extendido con un
  quinto parámetro opcional usando el patrón Unit of Work ya
  establecido (`withTransaction`), para que `reverseMatch` pueda
  reversar el asiento y ajustar el saldo bancario dentro de la MISMA
  transacción — sin tocar el único llamador existente
  (`journal-entries.controller.js`, que nunca pasa `tx`).
- **`treasury-accounts.service.convertToBase`**: exportada (antes
  privada) para reutilizar exactamente la misma conversión FX que ya
  usa la posición de caja consolidada, sin escribir una segunda rutina
  de conversión para el total de deuda.
- **`src/modules/finance/`** (nuevo, capa de lectura/consolidación
  siguiendo el precedente de `modules/reports`):
  `finance-summary.service.getFinanceSummary(companyId)` — arma
  `cashOnHand`/`availableLiquidity` (posición de caja consolidada,
  reutilizada de Tesorería), `totalReceivable`/`totalPayable`
  (reutilizados de `aging.service`, la fuente canónica ya existente de
  "cuánto me deben/debo"), `totalDebt` (solo préstamos, LOAN,
  convertidos a moneda base con `convertToBase` — los `CREDIT_LINE` se
  excluyen a propósito porque su cupo disponible ya está contado
  dentro de `availableLiquidity`/`liquidityCushion`, contarlo de nuevo
  duplicaría el mismo cupo con signo contrario), `committedPayments`
  (solo `PaymentOrder` en `DRAFT`/`PENDING_APPROVAL` — las `APPROVED`
  ya postearon su asiento y ya descontaron el saldo real, contarlas de
  nuevo duplicaría contra `cashOnHand`), `expectedNearTermInflows`/
  `expectedNearTermOutflows`/`firstNegativeWeek` (de
  `liquidity-forecast.service`, sin recalcular nada), y
  `missingExchangeRates` (honesto sobre qué monedas no se pudieron
  convertir, en vez de fingir una tasa). Rutas: `GET /finance/summary`,
  gateada por `requireAuth` + `requireModuleAccess('finance')`.
- **`core/glossary/glossary.service.js` refactorizado**: ya no importa
  directo `modules/fpa`/`modules/treasury`/`modules/accounts-receivable`
  para Tesorería/CxC/CxP — los 3 casos (`liquidity-cushion`,
  `accounts-receivable`, `accounts-payable`) ahora llaman a
  `financeSummaryService.getFinanceSummary(companyId)`. El import de
  `kpisService` (FP&A) se dejó tal cual, documentado como excepción
  deliberada (FP&A no forma parte del alcance de Finanzas en esta
  fase).
- **`core/rbac/module-access.js`**: `finance: ['ADMIN', 'COLLABORATOR',
  'ACCOUNTANT', 'FINANCE']` — puerta amplia de entrada; cada pantalla
  reutilizada debajo conserva su propia puerta más angosta (ej. la
  aprobación de pagos sigue exigiendo lo que ya exigía).
- **Frontend — `frontend/src/pages/finance/`**: `FinanzasLayout.jsx`
  (9 pestañas: Resumen/Dinero/Cobros/Pagos/Cuentas por Cobrar/Cuentas
  por Pagar/Financiamiento/Liquidez/Contabilidad Avanzada) +
  `ResumenPage.jsx` (la pantalla nueva de verdad: 8 `StatCard`
  respondiendo directamente "¿cuánto tengo?/¿cuánto me deben?/¿cuánto
  debo?/¿cuánto debo de financiamiento?/¿cuánto tengo comprometido?/
  ¿cuánto espero cobrar y pagar pronto?", con enlaces a la pestaña
  correspondiente y avisos condicionales de semana en riesgo/tasas
  faltantes) + `ContabilidadAvanzadaPage.jsx` (enlaza a las 4 pantallas
  de Contabilidad ya existentes, para quien necesite el detalle
  Debe/Haber sin tener que saber que "Contabilidad" es otro módulo
  técnico). Las otras 6 pestañas **reutilizan el mismo componente React
  ya existente** bajo la nueva ruta (`CashPositionPage`,
  `ArPaymentsPage`, `ApPaymentsPage`, `AgingPage` ×2 con el nuevo prop
  opcional `initialMode`, `DebtsPage`, `LiquidityForecastPage`) — cero
  componentes duplicados. Ítem "Finanzas" agregado al menú lateral,
  justo después de "Panel principal", con Tesorería/Contabilidad/CxC-CxP
  intactos y accesibles debajo tal cual estaban.

### Tests

5 tests nuevos de integración (`reconciliation-reverse.integration.test.js`,
contra Postgres real): reversión exacta del saldo + reversión del
asiento para un match que generó su propio asiento; doble reversión
del mismo match rechazada (la segunda no mueve el saldo una segunda
vez); aislamiento multiempresa (no se puede reversar el match de otra
empresa); un match contra un asiento ya existente solo desempareja,
nunca toca el saldo ni el asiento original; re-confirmación explícita
de no-doble-conteo (mismo escenario que el test de Fase 1, para
verificar que el rediseño de `reverseMatch` no reintrodujo el bug que
Fase 1 corrigió). 2 tests nuevos de integración
(`finance-summary.integration.test.js`): el resumen consolida montos
reales de AR/AP/Deuda/Órdenes de pago, cada uno leído de su motor real
(no recalculado); aislamiento multiempresa del resumen. `glossary.service.test.js`
reescrito completo (7 tests, mismo total) para reflejar el nuevo mock
de `financeSummaryService` en vez de los 3 mocks directos anteriores.

`src/test-helpers/integration-fixtures.js` ganó `createTreasuryAccount`
con parámetro opcional `currency` y un bloque nuevo de limpieza
(`cleanupCompany`) para `PaymentApproval`/`PaymentOrderBillApplication`/
`PaymentOrder`/`PaymentBatch`/`PaymentApprovalLevel`/`PaymentApprovalRule`/
`DebtMovement`/`DebtInstallment`/`Debt` — ninguna fase anterior había
creado tests de integración que tocaran estas tablas, así que la
limpieza no existía; se agregó en el orden correcto de dependencias FK.

**579 → 586 tests, sin regresiones** (94 suites, 586 passing). El resto
del checklist de la sección 42 (Dinero múltiples cuentas/monedas,
Cobros total/parcial/BCV, Pagos orden/aprobación, CxC/CxP vencimientos,
Deuda desembolso/cuota/interés) ya estaba cubierto por los motores
reutilizados sin modificar (`treasury-balance.integration.test.js` de
Fase 1 para el doble conteo de saldo; `aging.rules.test.js`/
`debt-schedule.rules.test.js`/`payment-approval.rules.test.js`/
`liquidity-forecast.rules.test.js`/`payment-calendar.rules.test.js` ya
existentes) — no se duplicó cobertura de lógica que Fase 5 no tocó,
mismo criterio ya usado en fases anteriores para generalizaciones
aditivas.

### Verificación end-to-end

`npx prisma validate` sin errores. `npm run lint` (backend) sin
errores ni warnings. `npm run build` (frontend) sin errores (mismo
warning preexistente de tamaño de chunk). `npm run lint` (frontend)
sin warnings nuevos (mismos 8 `only-export-components` ya conocidos de
los archivos de contexto). Verificado con Playwright contra los dos
servidores reales y Postgres real: login, ítem "Finanzas" presente en
el menú, las 9 rutas de `/finanzas/*` cargando con datos reales
(Resumen con los 8 montos reales: caja 200,00 US$, por cobrar 410,00
US$, por pagar 255,00 US$, entradas/salidas esperadas 410,00/255,00
US$), `/finanzas/cxc` y `/finanzas/cxp` mostrando correctamente su
propio modo por defecto (`initialMode`), `/finanzas/liquidez`
mostrando la previsión real de 8 semanas, `/finanzas/financiamiento`
reutilizando `DebtsPage` con su estado vacío correcto, y la ruta vieja
`/tesoreria/cuentas` funcionando exactamente igual que antes (sin
ninguna regresión). 0 errores de consola nuevos (los 13 observados son
el bloqueo ya conocido de Google Fonts en el entorno de pruebas).

### Pendientes documentados (no bloqueantes)

1. `ApPayment`/`PaymentOrder`/`ArPayment`/`Debt` siguen sin unificarse
   en un solo modelo — mismo pendiente heredado de Fase 1, fuera de
   alcance otra vez (el prompt de Fase 5 pidió unificar la EXPERIENCIA,
   no necesariamente los modelos de base de datos, sección 12).
2. RBAC granular de Finanzas (capacidades finas tipo `view_money`,
   `register_collection`, `approve_payment`) quedó documentado para una
   futura Fase 11 (sección 32 del prompt lo pide explícitamente así) —
   hoy la puerta de `finance` es amplia (los 4 roles entran), cada
   pantalla reutilizada abajo conserva su propia puerta angosta ya
   existente.
3. El Dashboard final (Fase 9) y el rediseño visual global (Fase 10) no
   se tocaron — Fase 5 solo preparó la fuente de datos consolidada
   (`finance-summary.service`) que esas fases futuras pueden reutilizar
   sin volver a calcular nada.
4. `ApPayment` sigue sin admitir pago ligado a un movimiento bancario
   real (`bankTransactionId`), a diferencia de `ArPayment` — pendiente
   heredado de Fase 4, no tocado en esta fase.
5. Todos los pendientes ya heredados de Fases 1-4 no resueltos acá:
   inspección/calidad de devoluciones a proveedor, TOCTOU de período,
   crons sin `lastRunAt` centralizado.

### Qué debe recordar Fase 6

**Heredado de Fases 1-4** (sin tocar, seguir usando): Unit of Work
(`withTransaction`), `postEntry(data, tx)`, `core/audit.log(data, tx)`,
`core/fx.getLatestRate`/snapshot BCV, `PaymentMethod` (core), los
puntos de escritura reales del proyecto — ninguno se duplicó.

**Construido en Fase 5** (reutilizar, no reconstruir):
`modules/finance/services/finance-summary.service.getFinanceSummary(companyId)`
es ahora la ÚNICA fuente consolidada de "cuánto tengo/me deben/debo/
debo de financiamiento/tengo comprometido/espero cobrar y pagar
pronto" — cualquier pantalla o módulo futuro que necesite estos
números (el Dashboard de Fase 9, por ejemplo) debe llamar a este
servicio, nunca recalcularlos ni volver a consultar `aging`/
`liquidity-forecast`/`treasury-accounts` por separado para lo mismo.
`reconciliation.service.reverseMatch` ya es atómico y correcto — no
necesita revisión, y `ReconciliationMatch.generatedNewEntry` es el
campo que cualquier lógica futura sobre conciliación debe leer para
saber si un match tiene un asiento propio. `ledgerService.reverseEntry`
ya acepta `tx` opcional — cualquier operación futura que necesite
reversar un asiento dentro de una transacción más grande debe
reutilizar este parámetro, no escribir una segunda función de
reversión. El patrón de "pantalla de módulo técnico reutilizada bajo
una ruta nueva sin duplicar el componente" (`FINANCE_TABS`, `App.jsx`)
es el patrón a seguir para cualquier futura capa de integración
similar.

**Lo que NO debe reconstruirse**: un segundo Ledger, un segundo motor
de pagos/cobros/deuda/liquidez/conciliación — los 6 ya existentes
(`core/ledger`, `ar-payments.service`, `ap-payments.service`,
`debts.service`, `liquidity-forecast.service`,
`reconciliation.service`) siguen siendo los únicos. `modules/finance`
es estrictamente de solo lectura — si Fase 6 necesita que Finanzas
ESCRIBA algo nuevo, eso es una decisión de arquitectura que debe
auditarse primero (mismo criterio de la sección 5 del prompt de Fase
5), nunca asumir que `modules/finance` es un lugar válido para
escritura solo porque ya existe.

FASE 5 COMPLETA

## Fase 6 — Monedas, BCV y Medios de Pago

### Objetivo de la fase

Auditar, consolidar y completar (nunca reconstruir) la arquitectura de
monedas/tasas de cambio/BCV/conversión/medios de pago/cobros/pagos que
ya existía desde Fases 1-5, garantizando: una única lógica de moneda,
una única fuente de tasas, snapshots históricos correctos, conversión
consistente, registro correcto de Pago Móvil/Zelle/Binance (nunca
tratados como integraciones de procesamiento), y consistencia con
Tesorería/Contabilidad/Ledger.

### Auditoría previa (mapa Concepto→Modelo→Servicio→Ruta→Frontend→Fuente de verdad)

Confirmado como **correcto y ya completo, sin tocar**:
- `Company.baseCurrency` — única fuente de verdad de la moneda de la
  empresa (sin tabla `Currency` separada, correcto).
- `ExchangeRate` (`[companyId, currency, date]` único, `rate` =
  unidades de moneda base por 1 unidad de `currency`) — única fuente
  de tasas, ya idempotente por `upsert`.
- `fxService.getLatestRate` — política de fallback "bloquear la
  operación" (`RATE_NOT_FOUND` 404) al **registrar** una operación
  nueva; `treasury-accounts.service.convertToBase` — política de
  fallback "degradar con gracia" (`missingExchangeRates`, nunca
  bloquea todo el reporte) al **consolidar/reportar**. Dos políticas
  deliberadas y coherentes para dos momentos distintos — documentado
  acá porque nunca se había explicitado juntas (sección 39/40).
- `core/fx.revalueAccount`/`revalueCompany` + `fx.cron.js` (mensual) —
  el único cron de FX del proyecto es de **revaluación**, no de
  obtención automática de tasas BCV — no existe ningún scraper/API de
  BCV integrado, cada tasa se registra a mano por diseño (sección 18).
  Confirmado, no se construyó ninguno nuevo.
- `TreasuryAccount.currency` — ya correctamente modelado, cuentas
  multimoneda ya soportadas y ya usadas por `getConsolidatedCashPosition`.
- `getConsolidatedCashPosition`/`finance-summary.service` (Fase 5) —
  ya manejan la degradación de tasa faltante correctamente, sin tocar.
- `PaymentMethod` (core, un solo catálogo) — ya cubre los 7 métodos
  pedidos (Efectivo/Transferencia/Tarjeta/Pago Móvil/Zelle/Binance/
  Otro), auditado, sembrado solo, sin procesar nada externamente.
- `PaymentOrderStatus` (DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/PAID/
  CANCELLED) — ya distingue Workflow (DRAFT/PENDING_APPROVAL) de
  Ejecución (APPROVED, el asiento ya se posteó) de una confirmación
  administrativa posterior (PAID, la exportación de lote) — sin crear
  ningún enum nuevo (sección 26).
- Transferencias `TreasuryAccount → TreasuryAccount`: **no existen en
  el proyecto** (confirmado por grep exhaustivo) — documentado, no
  inventado (sección 30-31).

Hallazgos reales, corregidos en esta fase (todos con evidencia de
código, nunca especulativos):

1. **`fxService.recordRate` nunca auditaba** (sección 41) — a
   diferencia de cada otra escritura sensible del proyecto.
2. **`ExchangeRate` no distinguía origen** (BCV vs. manual, sección 43)
   — el modelo no lo permitía, y era una distinción real pedida
   explícitamente.
3. **`resolveForeignAmount` duplicada byte por byte** en
   `ar-payments.service.js` y `ap-payments.service.js` (sección 9).
4. **`ApPayment.bankTransactionId` faltante** — el pendiente heredado
   nombrado explícitamente en la sección 24 del prompt, todavía real.
5. **Ni `ArPayment` ni `ApPayment` tenían un campo `reference`** para
   el número de confirmación de un Pago Móvil/Zelle/Binance/
   transferencia registrado directamente (sin `bankTransactionId`) —
   secciones 19-21, casi todos los pagos con estos métodos pasan por
   el camino directo (no existe parser de extracto para Zelle/Binance).
6. **`PaymentOrder.currency`/`Debt.currency` se guardaban pero nunca se
   usaban**: `decideApproval`/`disburseLoan`/`drawdown`/
   `repayCreditLine`/`payInstallment` posteaban el monto crudo al
   Ledger y al saldo de tesorería como si ya estuviera en la moneda
   base, sin validar nunca que la cuenta de tesorería elegida
   realmente estuviera en esa moneda — un usuario podía elegir una
   cuenta en Bs. para una orden/deuda "en dólares" y corromper el
   saldo en silencio (secciones 6/32).
7. **El mismo riesgo existía en el cobro/pago directo de AR/AP**: nada
   impedía elegir una cuenta de tesorería en otra moneda para un cobro/
   pago sin conversión — `data.amount` se trataba a la vez como si
   estuviera en la moneda de la cuenta (para `currentBalance`) y en la
   moneda base (para el Ledger), algo solo correcto si son la misma.
8. **No existía ninguna pantalla de frontend para registrar/ver tasas
   de cambio** (`/accounting/fx/rates` existía completo en el backend
   desde Fase 1/3, nunca conectado a una pantalla) — sección 45/62.
9. **La pantalla de Cobros (AR) nunca exponía método de pago ni
   moneda extranjera/BCV**, a diferencia de Venta Rápida y Pagos (AP,
   que sí tenía método de pago pero tampoco BCV ni banco) — una
   inconsistencia real entre pantallas hermanas (sección 45).

### Decisión de diseño: cerrar el hueco sin inventar un motor nuevo

Regla seguida en los 3 hallazgos de moneda (6/7): en vez de construir
conversión multimoneda nueva para PaymentOrder/Debt/cobro-pago directo
(que hubiera exigido tocar 4 servicios y el Ledger), se hizo **explícito
un supuesto que ya era implícito en todo el proyecto**: liquidar
cualquiera de estas operaciones exige que la cuenta de tesorería
elegida esté en la moneda base de la empresa — nueva función pura
`assertBaseCurrencySettlement(baseCurrency, treasuryAccount, context)`
en `core/fx/fx.rules.js` (testeada, reutilizada por AR/AP/PaymentOrder/
Debt), que rechaza con un mensaje claro en vez de corromper un número.
Una cuenta en otra moneda sigue siendo 100% válida para todo lo demás
(verla en Dinero/Tesorería, recibir el snapshot `foreignCurrency`/
`foreignAmount`/`exchangeRate` de AR/AP). Documentado explícitamente
como límite consciente: liquidar una Orden de Pago o una Deuda en una
moneda distinta a la base queda para una fase futura si se necesita de
verdad — mismo criterio que el proyecto ya usa para "no inventar"
transferencias multimoneda (sección 31).

### Qué se creó/extendió

- **Schema** (migración `fase6_currency_methods_reference`):
  `ExchangeRateSource` (enum `BCV`/`MANUAL`, default `BCV`) +
  `ExchangeRate.source`; `ArPayment.reference`/`ApPayment.reference`
  (String?); `ApPayment.bankTransactionId` (String? único, espejo
  exacto de `ArPayment.bankTransactionId`) + relación inversa en
  `BankTransaction.apPayment`.
- **`core/fx/fx.rules.js`**: `assertBaseCurrencySettlement` (función
  pura nueva, testeada — 3 tests). `core/fx/fx.service.js`:
  `recordRate` ahora recibe `userId`/`source`, audita
  `exchange_rate.recorded`/`exchange_rate.updated` con
  oldValue/newValue reales; `resolveForeignAmountSnapshot` (extraída,
  única, reemplaza las 2 copias duplicadas); reexporta
  `assertBaseCurrencySettlement`.
- **`ar-payments.service.js`**: usa `fxService.resolveForeignAmountSnapshot`
  (ya no una copia local); `resolvePaymentSource` ahora valida
  `assertBaseCurrencySettlement` antes de aceptar un cobro directo;
  `reference` se guarda si viene.
- **`ap-payments.service.js`**: gana `resolvePaymentSource` (espejo
  exacto del de AR — bankTransactionId con validación de salida de
  dinero, `reference`, `assertBaseCurrencySettlement` en el camino
  directo); `recordPayment` ahora puede recibir `bankTransactionId` en
  vez de `treasuryAccountId`+`amount`, marca el movimiento `MATCHED`
  igual que AR, sin duplicar el ajuste de saldo (la importación nunca
  tocó `currentBalance`, solo el registro operativo lo hace — mismo
  invariante de Fase 1, re-verificado).
- **`payment-orders.service.js`**: `assertOrderCurrencyCoherent`
  (coherencia interna moneda declarada↔cuenta + `assertBaseCurrencySettlement`)
  en `createPaymentOrder`/`createPaymentOrderForVendorBills`.
- **`debts.service.js`**: mismo criterio en `createDebt` (moneda
  declarada↔cuenta + `assertBaseCurrencySettlement`) — como todas las
  funciones de movimiento de una deuda (`disburseLoan`/`drawdown`/
  `repayCreditLine`/`payInstallment`) operan sobre una deuda YA creada,
  quedan seguras por construcción sin tocarlas.
- **Frontend**: `TasasDeCambioPage.jsx` (nueva, bajo Contabilidad,
  6ª pestaña) — registra/lista tasas, con Origen BCV/Manual, reutiliza
  las 3 rutas del backend ya existentes, cero endpoints nuevos.
  `ArPaymentsPage.jsx` gana método de pago + referencia + toggle de
  moneda extranjera (BCV) en el cobro directo. `ApPaymentsPage.jsx`
  gana el mismo "Origen del pago" (Directo/Movimiento bancario real)
  que ya tenía Cobros, más referencia y moneda extranjera.

### Tests

16 tests nuevos: 3 en `fx.rules.test.js` (`assertBaseCurrencySettlement`,
puros); 3 de integración en `fx-rate-audit.integration.test.js`
(auditoría de `recordRate`, origen BCV por defecto, origen MANUAL,
corregir la misma fecha audita oldValue/newValue reales); 10 de
integración en `settlement-currency-guard.integration.test.js`
(rechazo de cuenta en otra moneda para AR directo/PaymentOrder/Debt,
coherencia interna de moneda declarada en PaymentOrder/Debt, el camino
feliz de AP en la moneda base sigue funcionando, `ApPayment` ligado a
un movimiento bancario real con `currentBalance` descontado una sola
vez y `reference` guardada, movimiento ya conciliado rechazado,
movimiento de entrada rechazado para AP, y el caso obligatorio de la
sección 51 — snapshot histórico BCV de `ApPayment` que sobrevive a una
tasa nueva registrada después).

Corregido en el camino un bug real en `test-helpers/integration-fixtures.js`
`cleanupCompany`: `ArPayment`/`ApPayment.bankTransactionId` es
`RESTRICT`, pero la limpieza borraba `BankTransaction` ANTES que
`ArPayment`/`ApPayment` — nunca se había disparado porque ningún test
anterior dejaba un pago con `bankTransactionId` Y llamaba a
`cleanupCompany`; mi test nuevo de AP fue el primero en combinarlos.
Corregido moviendo la limpieza de pagos antes que la de movimientos
bancarios (beneficia también a AR, mismo riesgo latente).

**586 → 602 tests, sin regresiones** (96 suites, 602 passing). El
resto del checklist de la sección 50 (monedas/tasas/BCV/pagos por
cada método) ya estaba cubierto por los motores reutilizados sin
modificar (`quick-sale.integration.test.js` ya prueba el snapshot
histórico de AR, `purchases-ap.integration.test.js` ya prueba el
snapshot BCV de AP con Zelle, `payment-approval.rules.test.js`/
`debt-schedule.rules.test.js` cubren la mecánica pura de aprobación/
cronograma) — no se duplicó cobertura de lógica que Fase 6 no tocó.

### Verificación real

`npx prisma validate`: sin errores. `npm run lint` (backend): 0
errores. `npm run build`/`npm run lint` (frontend): sin errores
nuevos (mismos 8 warnings preexistentes `only-export-components`).
Verificado con `curl` autenticado contra Postgres real: tasa BCV de
VES registrada con `source: "BCV"` y listada correctamente. Verificado
con Playwright contra los dos servidores reales: pantalla de Tasas de
Cambio mostrando el historial real; Cobros con los 3 campos nuevos
visibles y el toggle de moneda extranjera cambiando el campo de monto
en vivo; Pagos con "Origen del pago"/referencia visibles. **Cobro real
de punta a punta con Pago Móvil**: registrado desde la pantalla,
confirmado por API que `paymentMethodId` apunta al método Pago Móvil
real y `reference: "REF-PM-998877"` quedó guardado, con su asiento
contable posteado. 0 errores de consola nuevos (los 4 observados son
el bloqueo ya conocido de Google Fonts).

### Pendientes documentados (no bloqueantes)

1. Pagar una Orden de Pago o una Deuda en una moneda distinta a la
   base de la empresa (conversión completa con snapshot, como ya
   tiene AR/AP) — decisión consciente de dejarlo fuera de Fase 6,
   documentada arriba; se puede construir si se pide, reutilizando
   `fxService.resolveForeignAmountSnapshot`.
2. Un cobro/pago con snapshot BCV (`foreignCurrency`) contra una
   cuenta de tesorería en una tercera moneda (ni la moneda extranjera
   ni la base) sigue sin soportarse — nunca fue el caso de uso pedido,
   la validación nueva lo rechaza con un mensaje claro en vez de
   corromperlo en silencio.
3. `QuickSalePage.jsx` (Venta Rápida) sigue sin exponer moneda
   extranjera/BCV en su formulario (solo método de pago) — mismo
   patrón de recorte de alcance ya usado en otras piezas del proyecto;
   se puede agregar reutilizando el mismo patrón ya construido en
   Cobros/Pagos.
4. Todos los pendientes ya heredados de Fases 1-5 no resueltos acá
   (unificación de `PaymentOrder`/`ApPayment`/`ArPayment`/`Debt`, RBAC
   granular de Finanzas, Dashboard/rediseño visual de Fases 9-10).

### Qué debe recordar Fase 7

**Heredado de Fases 1-5** (sin tocar, seguir usando): Unit of Work,
`postEntry(data, tx)`, `core/audit.log(data, tx)`, `modules/finance`
como única capa de lectura consolidada, `reverseMatch`/`reverseEntry(tx)`.

**Construido/corregido en Fase 6** (reutilizar, no reconstruir):
`fxService.resolveForeignAmountSnapshot(companyId, {foreignCurrency,
foreignAmount, date})` es ahora la ÚNICA función que resuelve un monto
en moneda extranjera a moneda base con snapshot — cualquier operación
futura que necesite este patrón (una eventual Orden de Pago o Deuda en
moneda extranjera, por ejemplo) debe reutilizarla, nunca escribir una
copia nueva. `fxService.assertBaseCurrencySettlement(baseCurrency,
treasuryAccount, context)` es la única función que valida coherencia
de moneda de liquidación — cualquier operación futura que mueva dinero
contra una `TreasuryAccount` debe llamarla antes de postear, tal como
ya hacen AR/AP/PaymentOrder/Debt. `ExchangeRate.source` (BCV/MANUAL)
es ahora el único lugar donde se distingue el origen de una tasa.
`TasasDeCambioPage.jsx` es la única pantalla de gestión de tasas — no
construir una segunda.

**Lo que NO debe reconstruirse**: un segundo motor de monedas, de
conversión, o de pagos — los ya existentes (`core/fx`, `PaymentMethod`,
`ar-payments.service`/`ap-payments.service`, `payment-orders.service`,
`debts.service`) siguen siendo los únicos. Ningún método de pago
(Pago Móvil/Zelle/Binance) debe convertirse en una integración de
procesamiento real — siguen siendo, por diseño, solo registro/control/
conciliación/trazabilidad.

FASE 6 COMPLETA

## Fase 7 — Fiscalidad y Cumplimiento

### Objetivo de la fase

Auditar, integrar y completar la arquitectura fiscal ya existente
(impuestos, retenciones, documentos fiscales, facturación electrónica,
libros fiscales, calendario fiscal, riesgo fiscal), garantizando que
Fiscal represente y controle el efecto tributario de las operaciones
reales del negocio — nunca una fuente de verdad paralela a Ventas/
Compras/CxC/CxP/Ledger.

### Auditoría previa (mapa Concepto→Modelo→Servicio→Ruta→Frontend→Fuente de verdad)

Hallazgo central de la auditoría: **el módulo Fiscal ya estaba
completo, correctamente integrado y bien diseñado desde antes de esta
fase** — construido en su propio orden histórico (Fiscal antes que AR/
AP), con AR/AP conectándose DESPUÉS como consumidores del motor fiscal
ya existente, exactamente como pide la sección 2 del prompt
("Fiscal... no convertirse en una fuente de verdad paralela"). Fase 7
fue mayormente confirmación con evidencia de código, con 2 correcciones
reales encontradas y cerradas.

Confirmado correcto, sin tocar (con evidencia de código, no solo
lectura de la bitácora anterior):
- **`FiscalTransaction`** — 1 a 1 con `JournalEntry` (única), 1 a 1
  opcional con `ArInvoice`/`ApBill`; puede existir standalone (registro
  manual desde la pantalla de Transacciones) o nacer de una factura de
  venta/compra. `fiscal-transactions.service.createFiscalTransaction`
  es el ÚNICO punto que calcula impuesto/retención y postea el asiento
  — nunca se duplica ese cálculo en otro lugar (confirmado leyendo
  `ar-invoices.service.createInvoice`: `ArInvoice.taxAmount`/
  `withholdingAmount`/`totalAmount` se copian DIRECTO del resultado de
  `createFiscalTransaction`, nunca se recalculan — el único cálculo
  "propio" que hace AR es una ESTIMACIÓN de solo lectura para validar
  el límite de crédito ANTES de tocar Fiscal, documentada como tal,
  resolviendo la MISMA tasa, nunca una lógica distinta).
- **Unit of Work end a end**: `createInvoice`/`createBill` pasan `tx`
  a `createFiscalTransaction`, que a su vez pasa `tx` a
  `ledgerService.postEntry` — asiento + FiscalTransaction + factura
  quedan en una sola transacción (secciones 8/9/25).
- **Retención vs. impuesto**: `TaxType` (`VAT`/`WITHHOLDING`/`OTHER`)
  nunca los confunde; `FiscalTransaction` tiene `taxRateId`/
  `taxAmount` y `withholdingRateId`/`withholdingAmount` como pares
  completamente separados (sección 15).
- **Vigencia/históricos**: `TaxRate.validFrom`/`validTo`, nunca se
  edita una tasa vencida (se cierra y nace una nueva) — una
  `FiscalTransaction`/factura ya emitida guarda el `taxAmount`
  calculado como valor, nunca una referencia viva a la tasa (secciones
  11/47-49). Confirmado con test dedicado.
- **Devoluciones vs. notas de crédito**: `ArCreditNote`/
  `ApCreditNote.relatedInventoryMovementId` es opcional — una
  devolución física (con salida de inventario real,
  `VENDOR_RETURN_EXIT` del lado de compras) se liga aparte de un
  simple ajuste financiero (ej. un descuento), nunca se fuerza el
  vínculo (sección 17).
- **Facturación electrónica**: confirmado 100% MOCK
  (`FiscalDocumentProvider { MOCK }`, patrón adapter listo para un
  proveedor real sin tocar el resto), estados
  `GENERATED/REJECTED/CANCELLED` ya cubren el ciclo, el proveedor MOCK
  simula un rechazo real (NIT/RFC faltante) para poder probar el
  camino de error sin depender de una API — nada de esto se tocó
  (secciones 18-20, 55).
- **RBAC ya correcto**: `MODULE_ROLES.fiscal = ['ADMIN','ACCOUNTANT']`
  (puerta del módulo) + `canManage = requireRole('ADMIN')` en cada
  ruta de escritura de los 6 sub-módulos — Contador entra con
  solo-lectura, Financiero/Colaborador no entran, exactamente la
  matriz ya documentada en una fase anterior. Confirmado en el código,
  no solo en la bitácora (sección 52).
- **Multimoneda**: `FiscalTransaction` nunca necesitó su propia lógica
  de conversión — sus montos son siempre moneda base (mismo invariante
  del Ledger), y el único lugar donde el pago de una factura puede
  venir en moneda extranjera (`ArPayment`/`ApPayment.foreignCurrency`)
  ya reutiliza Fase 6 completa desde que se construyó — no había nada
  que hacer acá, confirmado que no existe una segunda lógica de
  conversión fiscal (secciones 33-34).

### Hallazgos reales, corregidos

1. **`determineInvoiceStatus`/`determineBillStatus`: bug real de
   estado** (secciones 16/26/61). El orden de los chequeos hacía que
   una factura reducida a $0 por una nota de crédito del 100% (nunca
   cobrada, `paidAmount` también 0) leyera **`OPEN`** en vez de
   `PAID` — porque `paid.isZero()` se evaluaba antes que
   `paid >= total`. Una nota de crédito total es, en esta
   arquitectura, la forma ya existente de "revertir" una factura
   (nunca se borra, se ajusta con su propio asiento — mismo criterio
   que `core/ledger.reverseEntry`) y necesitaba que el estado
   resultante reflejara correctamente que ya no queda nada pendiente.
   Corregido invirtiendo el orden de los 2 chequeos en ambas funciones
   (espejo exacto AR/AP) — sin cambiar ningún otro caso ya probado.
2. **El libro fiscal (venta/compra) nunca reflejaba notas de crédito/
   débito** (sección 43, explícitamente nombrada como algo a auditar;
   sección 16, "Ajuste fiscal" como paso nombrado del flujo). Una nota
   de crédito NUNCA vuelve a pasar por el motor fiscal (decisión ya
   tomada y correcta, ver arriba), así que nunca generaba ni ajustaba
   una `FiscalTransaction` — el libro, que solo sumaba
   `FiscalTransaction`, quedaba ciego a cualquier nota emitida en el
   periodo. Para una declaración de IVA real esto era un hueco
   genuino. Corregido: `getSalesBook`/`getPurchasesBook` ahora
   incluyen una sección aparte con las notas reales del periodo
   (`ArCreditNote`/`ApCreditNote`, leídas tal cual — nunca se inventa
   un desglose base/impuesto que esas notas nunca tuvieron) y un
   `netTotal` (base + impuesto ajustado por el efecto neto de las
   notas). Nunca se mezclan con las líneas de `FiscalTransaction`, para
   no sugerir una precisión que no existe en el dato.

### Qué se creó/extendió

- **`ar-invoices.rules.js`/`ap-bills.rules.js`**: `determineInvoiceStatus`/
  `determineBillStatus` reordenados (fix #1).
- **`fiscal-books.service.js`**: `getCreditNotesForBook` (nueva),
  `buildBookWithNotes` (nueva, envuelve la función `getBook` ya
  existente sin duplicar su lógica) — `getSalesBook`/`getPurchasesBook`
  ahora devuelven `creditNotes`/`netCreditNoteEffect`/`netTotal` además
  de los campos que ya devolvían (aditivo, compatible).
- **Frontend**: `FiscalBooksPage.jsx` gana la sección "Notas de crédito
  y débito del periodo" + "Total neto del periodo", debajo de la tabla
  de ventas/compras ya existente — reutiliza `StatusSeal`/`EmptyState`/
  `HelpTooltip` ya usados en el resto de la pantalla, sin ningún
  componente nuevo.
- **Ningún cambio de schema** — Fase 7 no necesitó ninguna migración:
  los 2 hallazgos se resolvieron con lógica de servicio, reutilizando
  datos que ya existían.

### Tests

7 tests de integración nuevos (`fiscal-coherence.integration.test.js`,
contra Postgres real, con la tasa REAL que cada test configura, nunca
una regla fiscal impuesta): **test de coherencia** (sección 59, venta
con la tasa configurada → Factura = Fiscal = CxC = Ledger balanceado,
los 4 exactamente iguales); **test de nota de crédito** (sección 60,
nota del 100% deja la factura en `PAID` — confirma el fix #1 — sin
crear una segunda `FiscalTransaction`, y el libro fiscal ya la
refleja — confirma el fix #2); **test de reversión** (sección 61, el
asiento original de la venta nunca se toca, la nota queda auditada);
**test multiempresa** (sección 62, tasas/transacciones/libros
aislados entre 2 empresas reales); **test de históricos** (sección 63,
cerrar una tasa y crear una nueva y más alta no recalcula una factura
ya emitida con la tasa anterior); **2 tests de idempotencia/
atomicidad** (secciones 25/56/57/64: una regla de riesgo bloqueante no
deja ningún asiento/FiscalTransaction/factura huérfano; generar un
comprobante electrónico dos veces sobre la misma transacción se
rechaza, nunca duplica el documento).

Corregido en el camino un bug latente más en
`test-helpers/integration-fixtures.js` `cleanupCompany` (mismo patrón
ya encontrado y corregido 2 veces en Fase 6): `TaxRate.jurisdictionId`
y `FiscalObligation.jurisdictionId` son `RESTRICT`, pero la limpieza
borraba `TaxJurisdiction` sin haber borrado antes `TaxRate`/
`FiscalObligation` — nunca se había disparado porque ningún test
anterior creaba una `TaxRate` real y llamaba a `cleanupCompany`.
Corregido agregando esas 3 líneas de limpieza (+ `FiscalRiskRule`, por
prolijidad) en el orden correcto.

**602 → 609 tests, sin regresiones** (97 suites, 609 passing).

### Verificación real

`npx prisma validate`: sin errores (sin migración esta fase).
`npm run lint` (backend): 0 errores. `npm run build`/`npm run lint`
(frontend): sin errores nuevos. Verificado con Playwright contra los
dos servidores reales: Libros Fiscales muestra la nueva sección
"Notas de crédito y débito del periodo" con el estado vacío correcto.
Verificado con `curl` autenticado contra Postgres real: nota de
crédito parcial de $50 emitida sobre una factura real de $410 →
`GET /fiscal/books/sales` devolvió la nota en `creditNotes`,
`netCreditNoteEffect: "-50.00"`, `netTotal: "560.00"` (610 de base
menos 50 de la nota), exacto.

### Pendientes documentados (no bloqueantes)

1. `lastRunAt` centralizado en los crons (incluido el de Alertas
   Fiscales) sigue sin resolverse — pendiente heredado, mejora
   transversal explícitamente fuera de esta fase (sección 29).
2. Ninguna integración externa real de facturación electrónica — sigue
   siendo decisión consciente, documentada desde que se construyó.
3. Pendientes heredados de Fases 1-6 no resueltos acá.

### Qué debe recordar Fase 8

**Heredado de Fases 1-6** (sin tocar, seguir usando): Unit of Work,
`postEntry(data, tx)`, `core/audit.log(data, tx)`, `core/fx`
(`resolveForeignAmountSnapshot`/`assertBaseCurrencySettlement`),
`modules/finance` como única capa de lectura consolidada.

**Construido/corregido en Fase 7** (reutilizar, no reconstruir):
`fiscal-transactions.service.createFiscalTransaction` sigue siendo el
ÚNICO punto que calcula impuesto/retención y postea el asiento fiscal
— cualquier módulo futuro que necesite el efecto fiscal de una
operación debe llamarlo, nunca recalcular impuesto por su cuenta.
`fiscal-books.service.getSalesBook`/`getPurchasesBook` ahora son la
única fuente que combina `FiscalTransaction` + notas de crédito/débito
reales del periodo — cualquier reporte fiscal futuro (Fase 8) debe
reutilizar esta función, nunca sumar `FiscalTransaction` por su cuenta
ignorando las notas. `determineInvoiceStatus`/`determineBillStatus`
(orden corregido) son la única fuente de verdad del estado de una
factura/bill — cualquier código nuevo que necesite saber si un
documento está saldado debe llamarlas, nunca comparar `paidAmount`
contra `totalAmount` a mano.

**Lo que NO debe reconstruirse**: un segundo sistema de facturas, de
clientes/proveedores, de impuestos, de Ledger, de CxC/CxP, de
inventario, ni una segunda integración de facturación electrónica —
los ya existentes (`fiscal-transactions.service`, `Customer`/`Vendor`,
`TaxRate`/`TaxJurisdiction`, `core/ledger`, AR/AP, Inventario,
`electronic-invoicing.service` con su adaptador MOCK) siguen siendo
los únicos.

FASE 7 COMPLETA

## Fase 8 — Analítica, KPIs, Reportes y Forecast

### Objetivo de la fase

Auditar y unificar la arquitectura de analítica/KPIs/reportes/
presupuesto/forecast a través de FP&A, Métricas del Negocio, Reportes
y Análisis Avanzados, garantizando una sola fuente de verdad por
métrica — sin construir un segundo motor de KPIs/métricas/dashboard a
menos que la auditoría demostrara que hace falta de verdad (sección
38 del prompt oficial: demostrar necesidad antes de crear).

### Auditoría previa (mapa Concepto→Modelo→Servicio→Ruta→Frontend→Fuente de verdad)

Hallazgo central: **la arquitectura analítica ya estaba bien
distribuida y correctamente unificada desde antes de esta fase** — no
hay una segunda realidad de datos para ninguna métrica auditada.
Confirmado con evidencia de código (no solo lectura de la bitácora):

- **`reports/services/dashboard.service.js` es un CONSUMIDOR PURO**
  (patrón adapter/registro, igual que los parsers de Tesorería y los
  proveedores de Fiscal): su `WIDGET_DEFINITIONS` no tiene ni una
  línea de cálculo propio — cada widget llama directo a
  `treasuryAccountsService.getConsolidatedCashPosition`,
  `fpa/kpisService.getEbitda`/`getBurnRateAndRunway`,
  `accounting/reportsService.getIncomeStatement`/`getBalanceSheet` o
  `core/alerts.listAlerts`. Confirmado leyendo el archivo completo, no
  solo su firma.
- **`fpa/services/scenario.rules.js` (What-If) es genuinamente puro**:
  cero llamadas a `prisma.` en todo el archivo — confirmado con
  `grep`. `scenarios.service.simulateScenario` (solo lectura, proyecta
  sobre la Previsión de Liquidez real de Tesorería) y `saveScenario`
  (función aparte, la única que escribe) siguen siendo funciones
  distintas — la garantía de "la simulación nunca muta datos reales"
  queda por construcción del código, no por convención. Confirmado
  ahora también con un test de integración real (ver Tests).
- **`business-metrics.rules.computeMetricStats`** es conceptualmente y
  arquitectónicamente distinta de un KPI: opera solo sobre valores que
  el usuario escribió a mano, nunca sobre una fórmula del mayor
  contable — confirma la distinción ya documentada en una fase
  anterior, no encontró superposición real con FP&A.
- **`advanced-analytics/services/shared-data.js`** llama directo a
  `kpisService.getEbitda` y a
  `accountingReportsService.getIncomeStatement` — nunca recalcula
  EBITDA ni el Estado de Resultados por su cuenta, confirma reuso, no
  duplicación.
- **RBAC**: `MODULE_ROLES` ya tenía la matriz correcta para los
  módulos analíticos — sin cambios.
- **`core/glossary`** (construido en una fase anterior) resultó ser el
  análogo más cercano que el proyecto ya tenía a un "catálogo de
  KPIs": 6 términos con `hasLiveValue: true` que ya resuelven un valor
  real reutilizando el mismo servicio que otra pantalla (ej. el Panel
  principal) — la decisión de la fase fue extender esto, no crear un
  `core/analytics` nuevo.

**Conclusión de la auditoría**: construir un `core/analytics` nuevo no
se justificaba con la evidencia encontrada — se decidió extender
`core/glossary` con la metadata estructurada que pide la sección 8 del
prompt (fórmula/fuente/unidad/periodicidad/dimensiones) y sumar la
única métrica genuinamente faltante detectada ("Ventas de este mes",
que el Panel principal ya graficaba sin que el glosario la conociera).

### Qué se creó/extendió

- **`core/glossary/glossary-catalog.js`**: los 6 términos con
  `hasLiveValue: true` ganaron `formula`/`sourceRef`/`unit`/
  `periodicity`/`dimensions` (metadata estática, nunca calculada) +
  nuevo 7° término `sales-this-month` ("Ventas de este mes"),
  `sourceRef: ar-invoices.service.js#getSalesTrend`.
- **`core/glossary/glossary.service.js`**: `listTerms()` ahora expone
  también esos campos de metadata; `getLiveValue()` ganó el caso
  `sales-this-month`, que llama a `arInvoicesService.getSalesTrend(
  companyId, { months: 1 })` y toma el único balde que devuelve — la
  MISMA función que ya alimenta el gráfico de ventas del Panel
  principal, nunca una suma de facturas aparte.
- **Frontend**: `GlossaryTerm.jsx` ganó una línea "Cómo se calcula:
  <fórmula>" (solo si el término la trae); `DashboardPage.jsx` envolvió
  la palabra "ventas" del título del gráfico de tendencia con
  `<GlossaryTerm termKey="sales-this-month">`.
- **Ningún cambio de schema** — Fase 8 no necesitó ninguna migración:
  todo se resolvió extendiendo catálogo + servicio ya existentes.

### Tests

12 tests nuevos, todos contra Postgres real donde aplica (sin mocks
para los de integración):

- **`glossary.service.test.js`** (+2): `sales-this-month` reutiliza
  `getSalesTrend` con `{ months: 1 }`, nunca recalcula; `listTerms`
  expone la metadata de catálogo (fórmula/fuente/unidad/periodicidad)
  para los términos con valor en vivo, y confirma que un término sin
  valor en vivo (`double-entry`) no trae `sourceRef`.
- **`src/modules/reports/services/analytics-coherence.integration.test.js`**
  (nuevo, 9 tests):
  - **Test de una fuente** (sección 62, 3 tests): EBITDA del widget de
    Dashboard = EBITDA de FP&A directo = EBITDA del Glosario, los 3
    exactamente el mismo número; posición de caja del Dashboard =
    colchón de liquidez de Finance Summary/Glosario; cuentas por
    cobrar del Glosario = Finance Summary, ambos derivados de
    `aging.service`.
  - **Test multiempresa** (sección 63, 1 test): EBITDA y CxC de 2
    empresas reales nunca se mezclan.
  - **Test histórico** (sección 64, 1 test): el Estado de Resultados
    de enero no cambia al facturar en febrero (un reporte ya cerrado
    no se recalcula con datos futuros).
  - **Test de fecha de corte** (sección 67, 1 test): el Balance
    General al 31/01 y al 28/02 respeta exactamente el corte de fecha
    pedido, sin adelantar ni atrasar ningún movimiento.
  - **Test de presupuesto/variación** (sección 8, 1 test, NUEVO — el
    módulo FP&A nunca había tenido un test de integración real): un
    presupuesto de $1000 (agosto) contra un asiento real de $700
    etiquetado con la misma `FpaDimension` da exactamente -$300/-30% de
    desviación, `requiresJustification: true` (supera el umbral
    default de 10%), y el mismo $700 real coincide exacto con lo que
    ya reporta el Estado de Resultados de Contabilidad para ese mes —
    una sola fuente para "lo real".
  - **Test de moneda** (sección 66, 1 test, NUEVO): una cuenta de
    tesorería en EUR (200 EUR, tasa real registrada 1 EUR = 1.1 USD)
    se convierte exactamente igual (720.00 USD) tanto en el widget de
    caja del Dashboard como en Finance Summary — misma tasa, mismo
    resultado, sin `missingExchangeRates`.
  - **Test What-If** (secciones 32/65, 1 test): `simulateScenario` con
    un ajuste real (+10% ventas) no cambia ni el conteo de
    `JournalEntry`/`ArInvoice`/`BankTransaction` ni el saldo de
    `TreasuryAccount` — la simulación es de solo lectura, verificado
    con datos reales, no solo por inspección del código.
- **`fpa/services/budget.rules.test.js`** (+1): `calculateVariance`
  con presupuesto en cero y algo real gastado da 100% de desviación
  sin dividir entre cero (caso límite que faltaba junto a los ya
  existentes de 0%/+20%/0-contra-0).

**609 → 621 tests, sin regresiones** (98 suites, 621 passing).

Corregido en el camino un 4° bug latente del mismo patrón en
`test-helpers/integration-fixtures.js` `cleanupCompany` (ya encontrado
y corregido 3 veces antes — Fase 6 ×2, Fase 7 ×1): `BudgetLine.accountId`
es `RESTRICT` hacia `Account`, pero la limpieza nunca borraba ningún
`Budget` antes de `account.deleteMany` — nunca se había disparado
porque ningún test anterior había combinado un Presupuesto real de
FP&A con `cleanupCompany`. Corregido agregando
`budget.deleteMany({ where: { companyId } })` antes de la limpieza de
cuentas (cascada automática a `BudgetLine`/`BudgetVarianceJustification`
vía `onDelete: Cascade` del propio schema, sin tener que borrarlas a
mano).

### Verificación real

`npx prisma validate`: sin errores (sin migración esta fase). `npm run
lint` (backend): sin errores nuevos. Verificado con `curl` autenticado
contra Postgres real (dos servidores levantados, login real como
Administrador):
- `GET /glossary` → los 7 términos con valor en vivo devuelven su
  metadata completa (`formula`/`sourceRef`/`unit`/`periodicity`).
- `GET /glossary/ebitda/value` → `360.00`, exactamente igual a
  `GET /fpa/kpis/ebitda` (`ebitda: "360.00"`) y al widget `ebitda` de
  `GET /reports/dashboard`.
- `GET /glossary/sales-this-month/value` → `560.00`, exactamente igual
  a `GET /accounting/reports/income-statement` (`totalIncome: "560.00"`).
- `GET /reports/aging/receivables` (`CURRENT: 360.00`) exactamente
  igual a `GET /finance/summary` (`totalReceivable: "360.00"`).

Verificado con Playwright contra los dos servidores reales: clic en el
término "ventas" del Panel principal abre el popover con la definición
+ la nueva línea "Cómo se calcula" + el valor real "560,00 US$"; clic
en "EBITDA" muestra su fórmula y "360,00 US$" — coincide exacto con el
`curl` de arriba. 0 errores de consola reales (el único
`ERR_CERT_AUTHORITY_INVALID` es el bloqueo ya conocido de Google Fonts
en este entorno de pruebas, documentado en fases anteriores, sin
relación con este cambio). Captura de pantalla revisada.

**Rendimiento (medido, no un objetivo artificial fijado sin medir)**:
`GET /reports/dashboard` (4 widgets, incluye EBITDA/Burn-Runway/
Cash Position con conversión de moneda) respondió en 81ms en frío; 5
peticiones secuenciales tardaron 105ms en total (~21ms/petición en
caliente) contra Postgres real en este entorno — sin ningún indicio de
problema de N+1 ni de consulta lenta a esta escala de datos de prueba.

### Decisiones tomadas

- **No se construyó `core/analytics`**: la auditoría (sección 38 del
  prompt oficial exige demostrar necesidad antes de crear) no encontró
  evidencia de una segunda fuente de verdad ni de cálculo duplicado
  que justificara un módulo nuevo — el patrón consumidor-puro ya
  presente en Dashboard/What-If/Advanced Analytics/Glosario cumple el
  objetivo de la fase sin construir infraestructura nueva.
- **`core/glossary` queda como el catálogo de KPIs del proyecto**: en
  vez de crear una tabla/catálogo nuevo, se extendió el que ya existía
  y ya cumplía el mismo rol (definición + valor en vivo reutilizando
  el servicio canónico) — agregarle metadata estructurada era
  extender, no fusionar ni duplicar.
- **"Ventas de este mes" reutiliza `getSalesTrend` con `months: 1`**,
  nunca una consulta nueva de agregación — es literalmente la misma
  función que ya usa el gráfico del Panel principal, pidiendo un solo
  balde en vez de 6.

### Pendientes documentados (no bloqueantes)

1. `lastRunAt` centralizado en los crons sigue sin resolverse —
   pendiente heredado, fuera de esta fase.
2. Ninguna integración externa real de facturación electrónica — sigue
   siendo decisión consciente, documentada desde que se construyó.
3. Pendientes heredados de Fases 1-7 no resueltos acá.

### Qué debe recordar Fase 9

**Heredado de Fases 1-7** (sin tocar, seguir usando): Unit of Work,
`postEntry(data, tx)`, `core/audit.log(data, tx)`, `core/fx`
(`resolveForeignAmountSnapshot`/`assertBaseCurrencySettlement`),
`modules/finance` como única capa de lectura consolidada,
`fiscal-transactions.service.createFiscalTransaction` como único punto
de cálculo fiscal, `fiscal-books.service` como única fuente de libros
fiscales (incluye notas), `determineInvoiceStatus`/`determineBillStatus`
como única fuente del estado de un documento.

**Construido/confirmado en Fase 8** (reutilizar, no reconstruir):
`core/glossary` es el catálogo central de KPIs/métricas del proyecto
— cualquier métrica nueva que necesite una definición + un valor en
vivo debe registrarse ahí (`glossary-catalog.js` + un `case` en
`glossary.service.getLiveValue`), nunca en un catálogo paralelo.
`reports/services/dashboard.service.WIDGET_DEFINITIONS` es el único
registro de widgets del Dashboard — un widget nuevo es una entrada más
en ese registro que llama a un servicio ya existente, nunca cálculo
propio. `fpa/services/scenarios.service.simulateScenario` sigue siendo
la única simulación de solo lectura del proyecto (confirmado con test
real, no solo por diseño) — cualquier simulación futura debe seguir el
mismo patrón de función separada para leer vs. función separada para
guardar. `budget-variance.service.getActualAmount` sigue siendo la
única fuente de "lo real" de una línea de presupuesto (vía
`JournalEntryLineFpaDimension`) — nunca sumar `JournalEntryLine` por
cuenta sola, sin la etiqueta de dimensión.

**Lo que NO debe reconstruirse**: un segundo catálogo de KPIs/métricas,
un segundo motor de widgets de dashboard, una segunda capa de
simulación What-If, un segundo cálculo de EBITDA/Burn Rate/Runway, ni
una segunda fuente de "lo real" para desviación presupuestaria — todos
los ya existentes (`core/glossary`, `dashboard.service`,
`scenarios.service`, `fpa/services/kpis.service`,
`budget-variance.service`) siguen siendo los únicos.

FASE 8 COMPLETA

## Fase 9 — Centro Operativo Inteligente + Dashboard Personalizable

### Objetivo de la fase

Transformar el Panel principal (Inicio) de una colección de tarjetas y
gráficos en una capa de lectura y decisión: responder "¿cómo está la
empresa? ¿qué requiere atención? ¿qué puedo hacer? ¿dónde lo
resuelvo?" — sin crear un segundo motor de KPIs, alertas, permisos,
preferencias o forecast. El Dashboard consume, nunca calcula.

### Auditoría previa

Hallazgo central: el proyecto ya tenía construida casi toda la
infraestructura de UX que Fase 9 pide — solo nunca se había conectado
al Inicio real:
- **`reports/services/dashboard.service.js`** (Reportes punto 6, Fase
  previa a los Fases 0-8): ya era un Read Layer puro por adapter
  (`WIDGET_DEFINITIONS`), pero vivía como una pantalla aparte
  ("Tablero Ejecutivo") gateada a `['ADMIN','FINANCE']` — el Panel
  principal real (`DashboardPage.jsx`) nunca lo usaba: hacía sus
  propias 3-5 llamadas directas (`/fpa/kpis/ebitda`,
  `/treasury/accounts/cash-position`, etc.), sin ninguna
  personalización real por usuario a pesar de que
  `DashboardWidgetPreference` ya existía completo en el schema.
- **Ningún widget filtraba por rol**: `listAvailableWidgets`/
  `getWidgetPreferences`/`getDashboard` no recibían el rol del usuario
  — un Colaborador que hubiera sabido el `widgetKey` podía, en teoría,
  pedir EBITDA o el Balance General vía API (nunca lo veía en el
  frontend, porque esa pantalla era ADMIN/FINANCE-only, pero la
  protección real de datos que pide la sección 12/40 no existía a
  nivel de widget).
- **Sistema de alertas central ya maduro** (`core/alerts`,
  `/notifications`): ya usado por `NotificationCenter.jsx` en el
  topbar, con su propio mapa `type → ruta` — exactamente lo que pide
  la sección 6/24 ("cada alerta lleva a su contexto"), solo nunca
  aparecía como sección del Inicio en sí.
- **Navegación ya tenía flyout + menú colapsable a íconos**
  (`AppLayout.jsx`, construido en una fase de features anterior) y una
  única fuente de verdad de pestañas por módulo (`moduleTabs.js`) —
  pero como una lista PLANA de 11-12 módulos, sin ninguna agrupación
  conceptual en las 6 áreas que pide la sección 14.
- **Acciones rápidas ya existían** (`QuickCreateFab.jsx`, botón
  flotante con Nueva factura/Nuevo gasto/Nuevo cliente) pero nunca
  como sección del propio Inicio, y sin la opción "Venta Rápida"
  explícita que pide la sección 8.
- **`PinnedItem`/`RecentlyUsedEntity`** ya existían — `PinnedItem` ya
  visible en el propio sidebar (sección "Anclados"); `RecentlyUsedEntity`
  está scoped a autocompletado de campos (cliente/cuenta/producto), no
  a "páginas visitadas recientemente" — no hay una fuente de datos
  genérica de "documentos recientes" que agregar al Inicio sin
  construir un tracking nuevo (documentado como pendiente, sección AD).
- **`Venta Rápida`** (`/ventas/rapida`, Fase 3) ya existe y reutiliza
  el mismo motor de AR/inventario/fiscal/ledger que la factura
  completa — confirmado, no hacía falta ningún cambio.

### Qué se creó/extendió (backend)

- **`dashboard.service.js`**: cada `WIDGET_DEFINITIONS` ganó `roles`
  (quién puede verlo — `null` = todos, mismo criterio que
  `active_alerts`, ya visible para todos en el topbar), `category`
  (`estado`/`atencion`/`vision`) y `type`
  (`metric`/`trend`/`comparison`/`alert`/`forecast`), sección 35-36.
  `listAvailableWidgets`/`getWidgetPreferences`/`getDashboard` ahora
  reciben el `role` del usuario y filtran ANTES de calcular — un
  widget que el rol no puede ver nunca llega a ejecutarse, nunca solo
  se oculta en el frontend (sección 12/40). Nueva
  `resetWidgetPreferences(userId)` (mismo patrón exacto que
  `table-preferences.service.resetPreferences`) para "Restaurar
  configuración predeterminada" (sección 38).
- **2 widgets nuevos, ambos envoltorios de un servicio que ya
  existía**: `finance_summary` (`finance/finance-summary.service`,
  Fase 5 — Caja/Liquidez/CxC vencida/CxP próximas en una sola
  llamada) y `liquidity_forecast` (`treasury/liquidity-forecast.service`,
  ya construido — Previsión de Liquidez 8 semanas, con
  `firstNegativeWeek`). Ninguno recalcula nada.
- **`finance-summary.service.getFinanceSummary`** ganó
  `overdueReceivable` (cambio aditivo: `totalOutstanding menos el
  balde CURRENT` de la MISMA agregación de `aging.service` que ya
  traía cargada — nunca una segunda consulta ni una segunda regla de
  "qué es vencido").
- **Rutas del Dashboard, des-gateadas de `requireModuleAccess('reports')`**:
  `dashboard.routes.js` ganó su propio `requireAuth` (mismo patrón ya
  usado por `/notifications`/`/glossary`/`/fx/latest-rates` — ruta
  neutral, sin gate de módulo) y se monta directo en `app.js` bajo
  `/reports`, ANTES del router gateado de Reportes (Express prueba
  primero sus rutas específicas; si ninguna calza, sigue con
  `reportsRoutes`, que conserva su gate `ADMIN/FINANCE` intacto para
  el resto de `/reports/*`). Sin esto, un Contador o Colaborador nunca
  hubiera podido ver siquiera un Inicio vacío. Nueva ruta
  `DELETE /reports/dashboard/preferences` (reset).

### Qué se creó/extendió (frontend)

- **`frontend/src/pages/DashboardPage.jsx`**: reescrito en 4 capas
  reales (sección 5-9): **Estado de la empresa** (StatCards a partir
  de los widgets `category: 'estado'` que YA filtró el backend por
  rol — Caja/CxC vencida/CxP próximas/EBITDA/Burn Rate/Runway, con
  período y moneda explícitos en el encabezado, sección 26/27);
  **Requiere tu atención** (reutiliza `notificationsApi.list` — el
  MISMO motor central que ya usa la campana, nunca un
  `dashboardAlerts.service.js` nuevo — con estado vacío honesto "No
  hay nada urgente que atender", sección 43); **Acciones rápidas**
  (7 botones, filtrados por rol con el mismo criterio de
  `core/rbac/module-access.js`; "+ Nueva Venta" abre el menú
  Venta rápida/Venta completa que pide la sección 8); **Cómo está
  evolucionando tu negocio** (los gráficos de ingresos/egresos y
  ventas YA existentes, ahora ocultos por completo — no en estado de
  error — para un rol que de todas formas no tiene acceso, más el
  nuevo widget de Previsión de Liquidez). "Personalizar Inicio":
  mostrar/ocultar + mover arriba/abajo (sin drag-and-drop, permitido
  explícito en sección 37) + "Restaurar configuración predeterminada"
  con confirmación (`ConfirmContext`, ya existente).
- **`frontend/src/config/alertLinks.js`** (nuevo): el mapa
  `type → ruta` que antes vivía solo dentro de `NotificationCenter.jsx`
  se extrajo a un archivo compartido — reutilizado ahora por
  `NotificationCenter` y por la sección "Requiere tu atención" del
  Inicio, sin duplicar el mapa (mismo criterio que ya se usó para
  `moduleTabs.js`).
- **`AppLayout.jsx`**: los 11-13 módulos del sidebar se agruparon en
  las 5 áreas del prompt que de verdad tienen contenido hoy
  (OPERACIONES, FINANZAS, CONTROL, ANALÍTICA, CONFIGURACIÓN — Inicio
  queda sin encabezado, es la puerta de entrada) — **cero rutas,
  módulos, permisos o `subItems` se tocaron**: es una agrupación
  puramente visual sobre los mismos `NAV_ITEMS` de siempre (sección
  15: "la implementación técnica conserva módulos internos, la UX no
  tiene por qué reflejarla"). El mecanismo de flyout en modo
  colapsado (ya construido) sigue intacto.
- **`ExecutiveDashboardPage.jsx`** (Reportes, la pantalla original):
  ganó el renderizado de los 2 widgets nuevos para no quedar con un
  hueco en blanco ahora que también los ofrece a ADMIN/FINANCE.
- **`api/reports.js`**: `executiveDashboardApi.resetPreferences()`
  nuevo, reutilizado por ambas pantallas (Inicio y Tablero Ejecutivo,
  que comparten el mismo backend).

### Navegación por procesos (secciones 15-22)

Interpretación explícita, documentada acá para que no se confunda con
un rediseño mayor no hecho: las 6 áreas conceptuales del prompt
(INICIO/OPERACIONES/FINANZAS/CONTROL/ANALÍTICA/CONFIGURACIÓN) se
implementaron como encabezados de sección sobre el MISMO menú lateral
ya construido — no se creó un flyout de "área" de 2 niveles nuevo
(Área → Submódulo) distinto del ya existente (módulo → sus propias
pestañas, en `moduleTabs.js`, ya usado tanto por el layout de cada
módulo como por el mini-panel del sidebar colapsado). "Compras" no es
un área de navegación nueva a propósito: comprar ya vive repartido
entre Cuentas por Cobrar y Pagar (Facturas de Compra/Proveedores) e
Inventario (Órdenes de Compra) — mover esas pantallas a un módulo
nuevo hubiera sido un rediseño estructural fuera de lo que pide la
sección 33/50 ("no realizar todavía un rediseño masivo"). "Control →
Gobierno" (Junta) tampoco ganó una entrada de navegación nueva: Junta
sigue siendo, por decisión explícita de una fase anterior, un widget
del Panel principal, no una pantalla aparte — se conserva su lógica
actual tal como pide la sección 18.

### Tests

11 tests de integración nuevos (`dashboard.integration.test.js`,
contra Postgres real, sin mocks): **RBAC por widget** (sección 12/40,
4 tests — un Colaborador nunca recibe los 7 widgets financieros/
fiscales sensibles ni en el catálogo, ni en preferencias, ni en el
Dashboard calculado; un Administrador recibe los 8; intentar
configurar un widget fuera de su rol se rechaza con
`WIDGET_NOT_FOUND`, no se ignora en silencio; un Contador ve
Contabilidad pero no FP&A); **multiempresa** (sección 39, 1 test — el
`finance_summary` de la empresa A nunca refleja las ventas de la
empresa B); **no mutación** (sección 47, 1 test — pedir el Dashboard 3
veces seguidas no cambia ningún conteo de `JournalEntry`/`ArInvoice`/
`Alert` ni el saldo de `TreasuryAccount`); **coherencia de los 2
widgets nuevos** (2 tests — `finance_summary`/`liquidity_forecast`
del Dashboard son exactamente lo que devuelve su servicio de origen
llamado directo); **preferencias** (3 tests — ocultar saca el widget
del Dashboard y restaurar lo devuelve; restaurar nunca borra datos de
la empresa, solo las filas de `DashboardWidgetPreference`; reordenar
persiste). Más 1 test de `finance-summary.service` heredado de Fase 5
re-verificado sin regresión.

**621 → 632 tests, sin regresiones** (99 suites, 632 passing).

### Verificación real

`npm run lint` (backend): 0 errores. `npm run build`/`npm run lint`
(frontend): sin errores nuevos (mismo baseline de 8 warnings
`only-export-components`, patrón arquitectónico ya conocido).
Verificado con `curl` autenticado contra Postgres real, con los 4
roles reales (`admin`/`contador`/`financiero`/`colaborador@demo.alarfly.com`):
`GET /reports/dashboard/widgets` devolvió exactamente 8 widgets para
ADMIN/FINANCE, 6 para ACCOUNTANT (sin `ebitda`/`burn_rate_runway`),
**1 solo widget (`active_alerts`) para COLLABORATOR** — confirma el
filtrado por rol funcionando en el servidor, no solo en el frontend;
`finance_summary` del Dashboard coincidió exacto con `/finance/summary`
llamado directo (215.00/0.00); ocultar un widget y luego `DELETE
/reports/dashboard/preferences` lo devolvió visible; un Colaborador
intentando activar `ebitda` recibió 400 `WIDGET_NOT_FOUND`. Verificado
con Playwright contra los dos servidores reales: Inicio de
Administrador con las 4 capas completas (6 StatCards de Estado,
"Requiere tu atención" con estado vacío correcto, 7 Acciones rápidas,
2 gráficos + Previsión de Liquidez de 8 semanas); modo "Personalizar
Inicio" con 8 widgets, ocultar "Resumen Financiero" y **confirmar tras
recargar la página completa que seguía oculto** (persistencia real en
el servidor, no solo estado local); "+ Nueva Venta → Venta rápida"
navegó correctamente a `/ventas/rapida`; sidebar confirmado agrupado
en las 5 áreas reales (`OPERACIONES/FINANZAS/CONTROL/ANALÍTICA/
CONFIGURACIÓN`); Inicio de Colaborador confirmado SIN ninguna tarjeta
de Estado (0 StatCards, ni EBITDA ni ningún dato financiero sensible)
pero con el gráfico de ventas y las acciones rápidas de venta
visibles — RBAC confirmado también en la UI real, no solo por API. 0
errores de consola reales en ambos roles (el único
`ERR_CERT_AUTHORITY_INVALID` es el bloqueo ya conocido de Google Fonts
en este entorno, documentado desde fases de features anteriores).

**Rendimiento (medido)**: `GET /reports/dashboard` para ADMIN (8
widgets, incluye conversión de moneda y previsión de 8 semanas)
respondió en un rango similar al ya medido en Fase 8 para el mismo
endpoint con menos widgets (~80-100ms en frío contra Postgres real en
este entorno) — sin indicio de N+1: los widgets se calculan con
`Promise.all` (en paralelo, no secuencial) y cada uno hace sus propias
consultas ya optimizadas por las fases anteriores; no se detectó
ninguna llamada duplicada nueva.

### Decisiones tomadas

- **`/finance/summary` (el endpoint original de Fase 5) NO se tocó**,
  a pesar de que hoy no filtra por rol internamente (abierto a los 4
  roles por decisión explícita y documentada de Fase 5: "cada pieza
  que consolida ya tiene su propio gate más fino debajo"). Endurecer
  ese endpoint estaba fuera del alcance declarado de esta fase
  (sección 50: "no modificar lógica de negocio existente sin
  justificación") y el nuevo mecanismo de RBAC por widget de esta fase
  es exclusivo de los widgets NUEVOS del Dashboard — documentado
  explícito como riesgo pendiente (ver abajo), no arreglado en
  silencio.
- **Los roles por widget se derivaron del mismo mapa ya establecido**
  (`core/rbac/module-access.js`): `cash_position`/`finance_summary`/
  `income_statement_summary`/`balance_sheet_summary`/
  `liquidity_forecast` → `ADMIN/ACCOUNTANT/FINANCE` (mismo nivel que
  el módulo `accounting`); `ebitda`/`burn_rate_runway` →
  `ADMIN/FINANCE` (mismo nivel que `fpa`, que no incluye a Contador);
  `active_alerts` → todos (ya era así en el topbar desde antes de esta
  fase). No se inventó una matriz nueva.
- **No se construyó una sección "Recientes" en el Inicio**:
  `RecentlyUsedEntity` está scoped a rankeo de autocompletado (qué
  cliente/cuenta/producto usó el usuario en un campo puntual), no a
  "qué páginas visitó" — construir eso exigiría un tracking de
  navegación nuevo que hoy no existe en ningún lado del proyecto.
  Documentado como pendiente honesto (sección AD) en vez de fingir
  reutilización de algo que no aplica.
- **"Compras" no es un ítem de navegación nuevo**: mover Facturas de
  Compra/Proveedores (hoy en Cuentas por Cobrar y Pagar) u Órdenes de
  Compra (hoy en Inventario) a un módulo "Compras" nuevo habría sido
  un rediseño estructural, explícitamente fuera de alcance de esta
  fase (sección 20 del prompt: "no mover funcionalidades sin verificar
  primero su dependencia técnica"; sección 50: "no rediseñar
  visualmente toda la aplicación").
- **Junta permanece como widget del Panel principal**, nunca se le
  creó una pantalla de navegación bajo "Control → Gobierno" — conserva
  su lógica actual tal como exige explícitamente la sección 18.

### Riesgos pendientes / deuda técnica

1. `/finance/summary` sigue sin filtrar por rol internamente (ver
   Decisiones arriba) — inconsistente con el RBAC ahora más estricto
   del Dashboard; no se tocó por estar fuera de alcance declarado.
2. Overlap visual menor: el botón flotante de ayuda contextual
   (`ContextualHelpButton`, `position: fixed` en la esquina inferior
   izquierda, ya existía antes de esta fase) puede superponerse
   visualmente sobre el último ítem del sidebar ("Métricas del
   Negocio") en viewports cortos, porque agrupar el menú en áreas
   agregó ~4 líneas de encabezado + espaciado al alto total del menú.
   El enlace sigue siendo funcionalmente clicable (el botón flotante
   solo tapa una porción pequeña); no se rediseñó el patrón de scroll
   del sidebar (que hoy crece con toda la página, sin panel propio)
   para no exceder el alcance de "sin rediseño masivo" de esta fase —
   documentado explícito para que Fase 10 (Design System) lo revise.
3. Pendientes heredados de Fases 1-8 no resueltos acá.

### Qué debe recordar Fase 10 (UX/UI + Design System)

**Heredado, sin tocar**: Unit of Work, `postEntry`, `core/audit.log`,
`core/fx`, `modules/finance` como capa de lectura consolidada,
`fiscal-transactions.service.createFiscalTransaction`, `core/glossary`
como catálogo de KPIs, `dashboard.service.WIDGET_DEFINITIONS` como
único registro de widgets del Dashboard.

**Construido en Fase 9**: el Inicio (`DashboardPage.jsx`) ya está
organizado en las 4 capas conceptuales (Estado/Atención/Acciones/
Visión) que Fase 10 debe **re-vestir visualmente, no reestructurar**
— los datos y la lógica de cada capa ya son reales y están probados.
El sidebar ya agrupa en 6 áreas conceptuales (`NAV_AREAS` en
`AppLayout.jsx`) — Fase 10 puede rediseñar el look del menú, pero
`NAV_AREAS`/`moduleTabs.js` siguen siendo la única fuente de verdad de
qué pantalla vive en qué área. `alertLinks.js` es la única fuente del
mapa alerta→ruta, reutilizado por 2 lugares ya — cualquier tercero
debe importarlo, no copiar el mapa. Cada widget del Dashboard ya trae
`category`/`type` como metadata — Fase 10 puede usarlos para elegir
visualización (StatCard vs. gráfico vs. lista) de forma más rica, sin
tener que volver a auditar qué widget es sensible para qué rol (ya
resuelto acá con `roles`).

**Lo que NO debe reconstruirse**: un segundo Dashboard, un segundo
motor de widgets, un segundo mapa de alertas, un segundo sistema de
preferencias de widgets, una segunda agrupación de navegación — todos
los de esta fase (`dashboard.service`, `alertLinks.js`, `NAV_AREAS`,
`DashboardWidgetPreference`) siguen siendo los únicos.

FASE 9 COMPLETA

## Fase 10 — UX/UI + Design System + Rediseño Visual Global

### Objetivo de la fase

Transformar visual y experiencialmente Alarfly sin alterar su
arquitectura funcional ni sus motores de negocio: auditoría visual
completa → Design System consolidado → implementación progresiva
(Prioridad 1: tokens/Core UI/Layout/Inicio → pantallas piloto) →
verificación de que 0 lógica de negocio cambió.

### Decisión de marca (confirmada explícitamente por el usuario antes de tocar nada)

El prompt oficial (sección 7) pide que "el rojo sea el color de marca
de Alarfly" — pero la identidad visual ya construida en sesiones
anteriores (documentada extensamente en `CLAUDE.md`) usa un acento
dorado ("Sello dorado", con `StatusSeal` diseñado alrededor de ese
color como elemento de firma). Antes de tocar un solo archivo se
preguntó explícitamente al usuario cómo proceder — **confirmó cambiar
el color de marca a rojo**, una migración de marca real, no un ajuste
cosmético menor. Se avisa acá porque es la decisión de mayor impacto
de toda la fase y determina todo lo demás.

### Auditoría visual (hallazgo central)

El sistema visual ya estaba **considerablemente más maduro y
consistente** de lo que un rediseño típico "desde cero" asumiría —
Alarfly ya tenía, de sesiones de features anteriores a las Fases 0-9:
un archivo único de tokens (`theme.css`, paleta dark-first ya
escalonada en niveles Tinta/Papel/Papel elevado, exactamente el
"Nivel 0/1/2/3" que pide la sección 6), tipografía de 2 familias con
escala definida, `frontend/DESIGN_SYSTEM.md` ya existente y detallado,
`core/ui/Icon.jsx` como sistema de iconografía único, `StatusSeal`
como patrón de estado dominante (41 archivos, contra 1 solo uso de un
badge suelto), y **0 colores hardcodeados fuera de `theme.css`** en
todo el frontend (confirmado con `grep` exhaustivo). Esto cambió el
enfoque de la fase de "construir un Design System" a "auditar,
consolidar lo que ya funciona, corregir lo que no, y ejecutar la
migración de marca con disciplina".

Hallazgos reales de la auditoría (matriz de inconsistencias):

| Elemento | Hallazgo | Acción |
|---|---|---|
| Botón | `core/ui/Button.jsx` (1 archivo) vs. clases `.btn*` planas (78 archivos) — visualmente idénticas, duplicadas en código | Documentado, no consolidado (ver Deuda técnica) |
| Modal/diálogo | `ConfirmContext`/`QuickCreateModal`/`ImportWizard` — mismos tokens exactos, sin componente `Modal` compartido | Documentado, no consolidado |
| Badge/Estado | `StatusSeal` ya dominante (41 vs. 1) | Sin acción necesaria |
| z-index | 10 valores arbitrarios sin escala (5/20/30/40/50/60/100/140/150/200) en 21 archivos | **Corregido**: escala de 9 tokens semánticos, mismo orden relativo preservado 1 a 1 |
| Radio | Sin nivel "pill" (badges escribían `999px`/`50%` a mano) | **Corregido**: `--radius-pill` |
| Elevación | Solo 2 niveles (`--shadow-card`/`--shadow-elevated`) para todo, desde un tooltip hasta un modal | **Corregido**: `--shadow-modal` nuevo, 6 consumidores reales (modal/drawer/toast) migrados |
| Color "Info" | No existía como token semántico (sección 14 lo pedía explícito) | **Corregido**: `--color-info` nuevo |
| Responsive | 0 `@media` en todo el frontend; scroll horizontal confirmado con Playwright por debajo de 1024px | **Corregido** (chrome de la app; alcance documentado abajo) |

### Bugs reales encontrados y corregidos durante la migración de marca

1. **Contraste roto por el cambio de marca** (`.ui-btn-primary` y 4
   lugares más: el logo "A" del sidebar, el botón flotante de creación
   rápida, el toggle activo de `FilterBuilder`, `::selection`): todos
   usaban `color: var(--color-bg)` para el texto encima de un fondo de
   marca — una coincidencia inofensiva con el dorado anterior (donde
   `--color-bg` oscuro ≈ el texto oscuro correcto), que con el rojo
   nuevo se volvió **texto casi negro sobre fondo vino**, confirmado
   con el color computado real (`rgb(11,13,16)` sobre `rgb(156,39,64)`).
   Corregidos los 5 a `--color-on-accent`, el token que ya existía
   justo para este caso.
2. **Bug preexistente, no introducido por esta fase, encontrado durante
   la revisión visual de las pantallas piloto**: cualquier
   `<input>`/`<select>` suelto dentro de una celda de
   `<table className="data-table">` (ej. las líneas de una factura de
   venta) nunca estaba envuelto en `.field` — la única regla que le
   daba fondo/borde oscuro — así que caía en el blanco por defecto del
   navegador con el texto casi blanco del tema encima, prácticamente
   invisible. Corregido con una regla nueva y aditiva
   (`.data-table input/select/textarea`), sin tocar ningún `.jsx` —
   arregla el patrón en cualquier tabla del proyecto que lo tuviera.
3. **Sidebar tapado por el botón flotante de ayuda contextual**
   (hallazgo ya documentado como pendiente en Fase 9): el sidebar
   creció con la nueva agrupación en 6 áreas y el último ítem
   ("Métricas del Negocio") quedaba parcialmente detrás del botón
   fijo. Corregido con una reestructuración real (no un parche): el
   sidebar pasa a `position: sticky; height: 100vh`, con una única
   zona de scroll interno (`.app-nav-main`) — el encabezado y el pie
   (Cerrar sesión) quedan siempre visibles. **Efecto secundario real
   encontrado con el propio E2E de esta fase**: el botón de contraer/
   expandir el sidebar terminó en la MISMA esquina que el botón de
   ayuda, y Playwright confirmó que el clic quedaba bloqueado
   (`intercepts pointer events`, con las bounding boxes idénticas).
   Corregido reservando espacio real (`padding-bottom`) en el pie del
   sidebar. Verificado con un test dedicado: el toggle cambia de
   estado y ya no se superpone con el botón de ayuda.

### Qué se creó/extendió

- **`theme.css`**: renombre global `--color-silver*` → `--color-brand*`
  (34 archivos CSS/JSX, un solo `sed` — cero cambios de comportamiento,
  solo nombre), valores nuevos de rojo vino (dark y light theme),
  `--color-negative` sin tocar a propósito (deliberadamente un matiz
  distinto — óxido, no vino — para que un botón de marca nunca se
  confunda con un error), `--color-info` nuevo, `--radius-pill`,
  `--shadow-modal`, escala de 9 tokens `--z-index-*`, documentación de
  3 breakpoints (768/1024/1280px, no usables como custom property
  dentro de un `@media` por limitación real de CSS).
- **`Button.css`, `FilterBuilder.css`, `AppLayout.css`, `QuickCreateFab.css`,
  `theme.css`**: los 5 bugs de contraste corregidos (ver arriba).
- **`module.css`**: regla nueva `.data-table input/select/textarea`
  (bug #2 de arriba).
- **`AppLayout.css`/`.jsx`**: sidebar `position: sticky` con scroll
  interno propio (bug #3), `padding-bottom` del pie para no tapar el
  toggle, `@media (max-width: 1024px)` (sidebar 200px + topbar sin
  nombre/rol — elimina el scroll horizontal confirmado por debajo de
  1024px).
- **`ExecutiveDashboardPage.jsx`, `context/ConfirmContext.css`,
  `core/ui/{QuickCreateModal,ImportWizard,RecordDrawer,BulkActionBar}.css`,
  `context/ToastContext.css`**: migrados a `--shadow-modal` (elevación
  correcta para el nivel modal/drawer/toast, antes compartían el
  mismo tier que un simple tooltip).
- **`frontend/DESIGN_SYSTEM.md`**: actualizado completo — paleta,
  tipografía, radio/sombras/z-index/breakpoints nuevos, la matriz de
  inconsistencias de arriba, y la reinterpretación del "Sello" (un
  sello de cera clásico es rojo, no dorado — la metáfora del documento
  oficial se mantiene intacta, si acaso más literal).

### Pantallas piloto (validación del Design System)

Verificadas con Playwright (capturas revisadas una por una): Inicio
(Fase 9), Finanzas → Resumen, Ventas → Venta Rápida, Inventario →
Catálogo, Cuentas por Cobrar y Pagar → Facturas de Venta (la pantalla
compleja con tabla + formulario que pedía la sección 47). Las 5 ya
heredaron la marca nueva y los tokens corregidos **sin necesitar
ningún cambio de código propio** — confirma que el sistema de tokens
ya estaba lo bastante disciplinado como para que un rebrand de esta
magnitud se resolviera casi enteramente en `theme.css` + los 3 archivos
de bugs puntuales de arriba, no archivo por archivo.

### Tests

Sin tests de backend nuevos (fase estrictamente de frontend, sin tocar
ningún endpoint/modelo/regla de negocio) — **632/632 tests de backend
sin regresiones** (confirmado 2 veces; una corrida intermedia con 1
fallo fue diagnosticada como contención transitoria del pool de
Postgres al correr las 99 suites en paralelo, no una regresión real —
la misma prueba pasó aislada y en una repetición completa
inmediatamente después). `npm run lint` backend: 0 errores.
`npm run build`/`npm run lint` frontend: sin errores nuevos (mismo
baseline de 8 warnings preexistentes `only-export-components`).

### E2E (17 verificaciones, todas contra los dos servidores reales)

Login, Dashboard (4 capas), Personalización (panel de 8 widgets),
Venta Rápida, Venta completa (Facturas de Venta), Compra (Facturas de
Compra), Inventario, Cobros, Pagos, Finanzas → Resumen, Reportes,
Navegación (breadcrumb), Sidebar colapsa/expande, Flyout visible en
modo colapsado, Toggle de colapso ya no tapado por el botón de ayuda
(confirma el fix del bug #3), Logout, Permisos (Colaborador confirmado
sin ninguna tarjeta de Estado financiero, ni EBITDA ni caja — RBAC de
Fase 9 intacto). **17/17 OK, 0 errores de consola reales** (el único
`ERR_CERT_AUTHORITY_INVALID` es el bloqueo ya conocido de Google Fonts
en este entorno).

### Regresión funcional

Ningún endpoint, modelo, migración, regla de negocio, permiso o
workflow se tocó — confirmado por diseño (todos los cambios de esta
fase son CSS/tokens + 2 archivos de layout, `git diff` limitado a
`frontend/src/**/*.css`, `frontend/src/**/*.jsx` de layout/dashboard, y
`frontend/DESIGN_SYSTEM.md`) y por los 632 tests de backend + los 17
checks E2E, que ejercitan los mismos flujos de negocio de siempre
(crear factura, ver dashboard, navegar) sin que ninguno cambiara de
resultado.

### Responsive

Auditado con Playwright a 1280/1024/768px. Corregido el scroll
horizontal del chrome de la aplicación (sidebar + topbar) por debajo
de 1024px. **Alcance reconocido explícitamente**: no se auditó ni se
rediseñó el contenido interno de cada pantalla individual (~150) para
mobile — la prioridad declarada por el propio prompt es desktop, y
esta fase se limitó a que el chrome permanente no se rompa, documentado
como pendiente honesto para una fase futura si se pide.

### Accesibilidad

`:focus-visible` sigue con anillo de 2px visible (ahora en el color de
marca nuevo). Los 3 estados semánticos (Verificado/Alerta/Objeción) y
el nuevo Info nunca dependen solo del color — `StatusSeal` ya combina
color + ícono + texto desde antes de esta fase, sin cambios. Los 5
bugs de contraste corregidos (arriba) son, en sí mismos, una mejora de
accesibilidad real (texto antes casi ilegible, ahora con contraste
correcto). No se corrió un auditor WCAG automatizado dedicado en esta
pasada — verificación manual dirigida por los hallazgos reales
encontrados.

### Performance frontend

Sin dependencias nuevas agregadas. Bundle CSS 65.57kB → 66.97kB
(+1.4kB, la nueva sección de z-index/breakpoints documentados y las
reglas de `.data-table input`) — sin impacto real. Bundle JS sin
cambios de tamaño relevantes (mismo aviso preexistente de chunk >500kB,
no nuevo de esta fase, fuera de alcance resolverlo acá).

### Decisiones tomadas

- **Botón y Modal: documentados como duplicación real, NO consolidados
  en código esta fase.** Ambos ya comparten exactamente los mismos
  tokens/valores (verificado línea por línea) — la duplicación es de
  código, no de apariencia, así que consolidar 78 archivos (Botón) o
  extraer un `core/ui/Modal.jsx` compartido (3 diálogos) es un
  refactor mecánico de tamaño considerable sin beneficio visual
  inmediato — se prefirió documentarlo con precisión (qué archivos,
  cuántos usos) para una fase de mantenimiento futura, en vez de
  apurar un cambio de 78 archivos bajo presión de tiempo.
- **`--color-negative` no se tocó a propósito**: aunque tanto la marca
  nueva como "negativo" están en la familia "rojo", se mantuvieron
  deliberadamente en matices distintos (vino vs. óxido/terracota) —
  la sección 15 del prompt explícitamente advierte contra depender
  solo del color, y la sección 7 advierte contra "convertir toda la
  interfaz en roja"; un botón de marca que se pudiera confundir con un
  estado de error habría violado ambas reglas a la vez.
- **Responsive limitado al chrome de la aplicación** (sidebar/topbar),
  no a las ~150 pantallas de módulo — decisión de alcance explícita,
  ver "Responsive" arriba.

### Riesgos pendientes / deuda técnica

1. Consolidación de código de Botón (78 archivos) y Modal (3 diálogos)
   — visualmente ya unificados, pendiente solo a nivel de
   mantenibilidad de código.
2. Responsive de contenido interno por pantalla (más allá del chrome)
   no auditado.
3. Venta Rápida (sección 33 del prompt: "debe convertirse en una de
   las experiencias UX más refinadas") sigue siendo, visualmente, un
   formulario administrativo compacto — ya hereda el Design System
   nuevo por completo, pero no se rediseñó su FLUJO (colapsar campos
   avanzados, defaults inteligentes) porque eso toca la lógica de la
   pantalla, no solo su presentación, y se prefirió no arriesgar un
   cambio de flujo bajo presión de tiempo sin poder verificarlo a
   fondo. Documentado explícito como pendiente, no resuelto en
   silencio.
4. Pendientes heredados de Fases 1-9 no resueltos acá.

### Qué debe recordar Fase 11

**Heredado, sin tocar**: toda la arquitectura de backend de Fases 0-9
(Ledger, Fiscal, FX, RBAC, Centro Operativo). El Design System vive en
`theme.css` + `frontend/DESIGN_SYSTEM.md` — cualquier pantalla nueva
sigue construyendo ÚNICAMENTE con `core/ui/*` y las clases de
`module.css`, nunca estilos aislados nuevos.

**Construido en Fase 10**: la marca de Alarfly es roja
(`--color-brand`), no dorada — cualquier mención futura de "el color
dorado" en código o conversación se refiere ahora a `--color-warning`,
no a la marca. La escala de z-index/el radio "pill"/el 3er nivel de
sombra ya existen — un componente flotante nuevo reutiliza
`--z-index-*`, nunca un número arbitrario nuevo. El sidebar tiene su
propio scroll interno (`.app-nav-main`) — cualquier ítem nuevo del
menú se agrega a `NAV_AREAS` (`AppLayout.jsx`), nunca a una lista
plana aparte.

**Lo que NO debe reconstruirse**: un segundo sistema de tokens, una
segunda paleta, un segundo componente de ícono, un segundo sistema de
navegación — todos los de esta fase y las anteriores siguen siendo los
únicos.

FASE 10 COMPLETA

---

## Fase 11 — Control Empresarial, Permisos, Workflows, Aprobaciones y Auditoría Avanzada

**Estado: FASE COMPLETA**

### Auditoría inicial (secciones 3-4 del prompt oficial)

Se leyó `PROGRESS_LOG.md` completo (Fases 0-10), `CLAUDE.md` (bitácora
de la etapa de features previa a las Fases numeradas) y se auditó en
vivo: `core/rbac` (roles + cupos + `requireModuleAccess`/
`requireAccessManagement`), `core/audit` (única tabla `AuditLog`,
`log/listForEntity/listForEntities/listForCompany`), `core/alerts`
(motor genérico, 10 tipos de alerta), `core/period-lock`,
`core/events/eventBus.js` (documentado en Fases previas como sin usar,
sin tocar), los 3 flujos maker-checker existentes (Tesorería/Órdenes de
Pago, Caja Chica, Inventario/Conteos Físicos), el único motor de
condiciones de aprobación por monto (`PaymentApprovalRule`/
`PaymentApprovalLevel`, Tesorería), los 9 jobs `node-cron`, y el
frontend relacionado (Centro de Notificaciones, `NivelesAccesoPage`,
Mi Cuenta > Actividad). Mapa de capacidades:

| Capacidad | Fuente única | Clasificación F11 |
|---|---|---|
| Autenticación/sesiones | `core/auth` | CONSERVAR |
| RBAC (rol → módulo) | `core/rbac/module-access.js` | CONSERVAR |
| Permisos delegados puntuales | `core/rbac/delegated-permissions.service.js` | CONSERVAR |
| Auditoría | `core/audit` | EXTENDER (filtro `action` + límite + ruta neutral) |
| Motor de alertas | `core/alerts` | EXTENDER (tipo `APPROVAL_PENDING` nuevo) |
| Aprobación multinivel por monto | Tesorería (`payment-approval.rules.js`) | CONSERVAR, sin generalizar (ver "Decisiones") |
| Segregación de funciones (maker-checker) | 3 implementaciones casi idénticas, sin punto compartido | **FUSIONAR** → `core/workflow/segregation.rules.js` (nuevo) |
| Bloqueo de periodo | `core/period-lock` | EXTENDER (TOCTOU corregido) |
| Jobs automáticos / última corrida | 9 archivos `*.cron.js`, sin ningún registro transversal | **CREAR** → `core/jobs` (nuevo, mínimo) |
| Multiempresa / seguridad de endpoints | Cada controller usa `req.auth.companyId` | CONSERVAR (auditado, sin hallazgos reales) |
| Workflows por dominio (comercial/financiero/fiscal/aprobación) | Cada módulo tiene su propio enum de estado ya coherente | CONSERVAR (ver sección "Workflows" abajo) |

No se creó ningún motor paralelo: ni segundo RBAC, ni segunda
auditoría, ni segundo Ledger, ni segundo sistema de alertas, ni
segundo Dashboard — la regla principal de la sección 2 del prompt se
cumplió sin excepciones.

### RBAC, permisos y workflows (secciones 6-9)

**RBAC**: se confirma el modelo de 4 roles de negocio
(ADMIN/ACCOUNTANT/FINANCE/COLLABORATOR) con cupo por empresa, ya
construido y probado en una fase de features anterior — sigue siendo
la única fuente (`core/rbac/module-access.js`). No se tocó.

**Permisos granulares (sección 7)**: se evaluó explícitamente subir de
"usuario → módulo" a "usuario → módulo → recurso → acción → condición"
y se decidió **no implementarlo de forma genérica** — el prompt mismo
lo advierte ("no implementar permisos granulares indiscriminadamente,
solo los que tengan valor empresarial real"). El único punto donde ya
existe una condición real por acción/monto (Órdenes de Pago:
"aprobar" es un permiso distinto de "crear", condicionado por monto vía
`PaymentApprovalRule`) ya está construido y no necesitaba
generalizarse — no hay hoy un segundo caso de uso real (ej. "aprobar
una nota de crédito según su monto") que justifique construir un motor
de reglas nuevo. Documentado como decisión explícita, no como pendiente
olvidado.

**Condiciones de aprobación (sección 8)**: ya existen, representadas
exactamente como pide el prompt (`Pago < $500 → automático`,
`$500-$5000 → FINANCE`, etc.) vía `PaymentApprovalRule.minAmount/
maxAmount` + `PaymentApprovalLevel.allowedRoles` por nivel — no se
construyó nada nuevo acá, solo se confirmó que el mecanismo ya cumple
el objetivo de la sección.

**Workflow transversal (sección 9)**: se audita la distinción que pide
el prompt entre estado comercial/financiero/fiscal/de aprobación —
Alarfly **ya respeta esta separación**, dominio por dominio, sin un
estado universal que los reemplace: `ArInvoiceStatus`
(comercial/financiero mezclado en AR por diseño ya documentado),
`PaymentOrderStatus` (DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/
CANCELLED — el ciclo de aprobación pedido en la sección 9, ya
construido), `JournalEntryStatus`, `PhysicalCountStatus`,
`PettyCashExpenseStatus`. Ningún estado se reemplazó ni se unificó:
la sección 9 explícitamente prohíbe eso y confirma que "estos estados
pueden coexistir" — exactamente la arquitectura ya encontrada.

### Aprobaciones y segregación de funciones (secciones 10-11)

Se auditaron las 3 implementaciones de "quien solicita no puede
aprobar" del proyecto (Órdenes de Pago, Caja Chica, Conteos Físicos de
Inventario) — construidas en fases separadas, con la misma regla
repetida casi palabra por palabra y ningún punto de código compartido.
**Se consolidó** en `src/core/workflow/segregation.rules.js`
(`assertDifferentActors`), la única función pura nueva de control de
esta fase — los 3 archivos originales la llaman ahora en vez de repetir
el `if`, conservando exactamente sus mismos mensajes, códigos de error
y firma pública (cero cambio de comportamiento para quien ya los usa,
confirmado con los 3 suites de test existentes sin tocar, más un test
nuevo de la función compartida). Esto responde directamente a la
sección 30 ("¿quién controla la segregación de funciones? → una
fuente") sin construir un motor de aprobación nuevo.

**Qué ocurre al rechazar/aprobar** (auditado, ya correcto, sin cambios
de lógica de negocio): rechazar una orden de pago la deja en
`REJECTED` sin postear nada; aprobar el último nivel postea el asiento
y descuenta el saldo dentro de una sola transacción (Unit of Work,
Fase 1); modificar una orden después de aprobada no está permitido (no
hay ningún endpoint que lo intente). Lo único que sí faltaba —y se
construyó en esta fase— es que **nadie se enteraba** de que una orden
quedó pendiente hasta entrar por su cuenta a la pantalla (ver
"Alertas" abajo).

### Auditoría, auditoría transaccional y audit filters (secciones 12-14)

`core/audit.log()` sigue siendo la única fuente de verdad, llamado
siempre dentro de la misma transacción Prisma que hace el cambio real
(ya así desde Fase 1 — Unit of Work) — auditado que Ledger/Tesorería/
AR/AP/Inventario/Fiscal lo siguen usando sin excepciones (`grep`
exhaustivo de `journalEntry.create`/`paymentOrder.update`/etc. fuera de
una transacción que también llame a `auditService.log`: 0 casos
sueltos encontrados).

`auditService.listForCompany` ganó dos parámetros nuevos:
`action` (filtro exacto, pedido explícito en la sección 14 con el
ejemplo "módulo Finanzas, acción APPROVED") y `limit` (default 200,
tope duro 1000 — sección 27, nunca devolver la bitácora completa de
la empresa sin límite). **Se corrigió de paso** un riesgo real
descubierto al agregar el límite: `core/account/services/
activity.service.js` (Mi Cuenta > Actividad personal, con exportación
JSON/CSV) llamaba a la misma función sin pedir un límite explícito —
con el nuevo default de 200 habría truncado en silencio la exportación
de un usuario con más de 200 eventos en su historial. Corregido
pidiendo el tope máximo (1000) desde ese único llamador, antes de que
llegara a producción.

### Ruta neutral de auditoría (sección 14, movimiento arquitectónico)

La bitácora vivía **solo** bajo `/accounting/audit-log`, detrás de
`requireModuleAccess('accounting')` — un artefacto histórico (se
construyó junto con Contabilidad en la Fase 0 del proyecto, antes de
que existieran los otros 8 módulos que hoy también auditan cosas). Se
movió a `GET /audit-log` (`core/audit/audit.routes.js`, nuevo, montado
directo en `app.js`), mismo criterio ya usado para `/notifications` y
`/fx/latest-rates` en fases anteriores — sin gate de módulo, pero
**sigue siendo ADMIN-only** (a diferencia de `/notifications`, que
cualquier rol usa: ver TODO lo que hizo toda la empresa es
información administrativa sensible, no una alerta personal). La ruta
vieja se eliminó (no rota: nada en el frontend la consumía, verificado
con `grep`; confirmado con `curl` que ahora devuelve 404). Ningún otro
consumidor externo documentado.

**Hallazgo real, no solo movimiento**: no existía **ninguna pantalla**
en todo el frontend que mostrara la bitácora general de la empresa —
solo la actividad personal de Mi Cuenta (que es otra fuente,
`userId`-scoped). Se construyó `AuditTrailPage` (ver "Frontend" abajo).

### Exportación de auditoría (sección 15)

Los mecanismos de exportación ya existentes (PDF/Excel de Reportes,
JSON/CSV de Mi Cuenta > Actividad) se conservaron intactos — no se
construyó un exportador nuevo para la bitácora general (fuera de
alcance de esta fase, la pantalla nueva es de solo consulta en
pantalla; se puede conectar a `core/utils/exporters` más adelante
reutilizando el registro ya existente, sin tocar nada).

### Alertas y control (sección 16)

**Hallazgo real**: una orden de pago pendiente de aprobación nunca
generaba ninguna alerta ni notificación — el aprobador solo se
enteraba si entraba por su cuenta a la pantalla de Órdenes de Pago.
Se conectó al motor de alertas ya existente (`core/alerts`, nunca un
mecanismo nuevo): nuevo tipo `APPROVAL_PENDING` (enum Prisma +
`core/alerts/alert-type.js` + `ALERT_TYPE_LABELS` de Mi Cuenta > 
Notificaciones — los 3 puntos que ya centralizan esto desde la
"lección repetida" documentada 3 veces en `CLAUDE.md`, para no volver
a desincronizarlos). Cada nivel de aprobación deja su propia alerta
(`entityId` compuesto `orderId:level:N`, mismo patrón ya usado por la
cobranza escalonada de AR) — se dispara al enviar a aprobación (nivel
1) y al completar un nivel intermedio (nivel N+1); se cierra
(`ACKNOWLEDGED`) la alerta del nivel recién decidido al aprobarlo, y
**todas** las alertas de la orden al rechazarla, aprobarla del todo o
cancelarla — nunca queda una alerta mostrando una orden que ya se
resolvió. Conectada en `NotificationCenter` vía `alertLinks.js`
(`APPROVAL_PENDING → /tesoreria/pagos`).

### Jobs / lastRunAt (sección 17)

**Hallazgo real**: los 9 jobs automáticos del proyecto (`fx`,
depreciación, 5 escaneos de alertas/obligaciones, facturas
recurrentes, reportes programados, análisis avanzados) solo dejaban un
`console.error` suelto en el log del proceso si algo fallaba — sin
ninguna forma de consultar después cuándo corrió cada uno, con qué
resultado, ni cuánto tardó. `AnalysisAutomationConfig.lastRunAt`/
`ScheduledReport.lastRunAt` (los únicos `lastRunAt` que ya existían)
son datos POR CONFIGURACIÓN/REPORTE, no por corrida del job en sí —
no resolvían el pedido de la sección 17.

Se construyó `src/core/jobs` (mínimo, sin motor de monitoreo nuevo):
modelo `JobRun` (una fila por corrida, por empresa — los jobs iteran
empresa por empresa, así que el aislamiento multiempresa de la
sección 19 aplica también acá), `job-registry.js` (catálogo en código
de los 9 jobs, mismo patrón ya usado por el catálogo de Análisis
Avanzados/Glosario — sin librería de parseo de cron nueva: la "próxima
ejecución" se muestra como texto simple, ej. "Todos los días, 6:00 am",
en vez de calcularla exacto, límite consciente documentado en el
propio archivo), `job-run.service.js` (`runJob(jobKey, companyId, fn)`:
mide, guarda éxito/error/duración, y **vuelve a lanzar el error
original** — el `catch` que ya tenía cada `*.cron.js` sigue viendo
exactamente el mismo error de siempre, cero cambio de comportamiento
fuera de la fila nueva que queda guardada). Los 9 archivos `*.cron.js`
se envolvieron (2-4 líneas cada uno, mecánico). Ruta neutral
`GET /jobs/status` (catálogo + última corrida) y `GET /jobs/runs`
(historial filtrable, paginado), ADMIN-only, montadas en `app.js`.

### Period Lock (sección 18) — bug real de TOCTOU encontrado y corregido

**Hallazgo real, el más significativo de la fase**: `core/ledger.
postEntry` validaba el periodo contable (`getPeriodForDate` +
`assertPeriodOpen`) **antes** de abrir la transacción que realmente
escribe el asiento — exactamente el escenario que describe la sección
18 ("validar periodo ↓ otra operación cierra periodo ↓ postear"). Una
petición que cerrara el periodo justo en esa ventana podía dejar un
asiento posteado en un periodo que ya quedaba cerrado, sin que nadie
lo notara. Afecta a los 6 módulos que postean vía `core/ledger`
(Contabilidad, Tesorería, AR, AP, Inventario, Fiscal) — es el ÚNICO
punto de escritura de asientos, así que corregirlo ahí protege a todos
sin tocar ningún llamador.

**Corrección** (mismo patrón "cliente transaccional opcional" ya
establecido en el proyecto desde Fase 1 — Unit of Work):
`periodLockService.getPeriodForDate`/`assertOpenForDate` ganaron un
tercer parámetro opcional `client` (default `prisma`); `ledger.service.
postEntry` mueve la validación del periodo **dentro** de `run(client)`,
usando el MISMO cliente transaccional que después escribe el asiento
— la revalidación ocurre con datos leídos dentro de la misma
transacción, no antes de que empiece. Se aplicó el mismo criterio a
`period-lock.service.closePeriod`: el conteo de "asientos sin aprobar"
(que bloquea el cierre) ahora se repite dentro de la misma transacción
que marca el periodo `CLOSED`, no antes. **Límite honesto documentado**:
con el nivel de aislamiento READ COMMITTED de Postgres (el que usa
Prisma por defecto en este proyecto), esto cierra la ventana de riesgo
mucho más grande que existía antes (todo el tiempo previo a abrir la
transacción), pero no elimina por completo una carrera teórica de
microsegundos entre dos transacciones concurrentes sin un bloqueo
explícito (`SELECT ... FOR UPDATE`/serializable) — se prefirió esta
corrección pragmática (coherente con "no crear motores paralelos") en
vez de introducir un mecanismo de bloqueo nuevo sin un caso real que
lo exija.

`decideApproval` (Órdenes de Pago) ya validaba el periodo antes de su
propia transacción, con el mismo patrón — se dejó tal cual (da un
error temprano legible antes de resolver aplicaciones de facturas) y
queda protegida por partida doble: la revalidación interna que ahora
hace `postEntry` cubre automáticamente este llamador también, sin
tocarlo.

### Multiempresa y seguridad de endpoints (secciones 19-20)

Auditoría explícita: `grep` de `req.body.companyId`/
`req.query.companyId`/`req.params.companyId` en todo `src/` — **un
solo resultado**, `companies.service.switchActiveCompany` (Mi Cuenta >
cambiar de empresa activa), ya protegido correctamente (valida
`UserCompanyAccess` antes de reemitir el token — confirmado leyendo el
servicio). Ningún controlador manipulable encontrado. `grep` de
controladores que NO referencian `req.auth.companyId` en ningún lado:
0 resultados — todos escriben/leen siempre scoped a la empresa de la
sesión. Se probó en vivo (`curl`) que un Colaborador recibe 403 en
`/audit-log` y `/jobs/status`, y que la ruta vieja `/accounting/
audit-log` ya no existe (404). No se encontró ninguna vulnerabilidad
real de manipulación de `companyId` ni de saltarse un estado de
aprobación — sección 20 auditada sin hallazgos que corregir más allá
de los ya cubiertos arriba (TOCTOU de periodo, alertas de aprobación).

### Frontend (secciones 21-23)

Sin rediseño de nada existente — reutiliza tokens/`StatusSeal`/
`EmptyState`/`HelpTooltip`/`Breadcrumb`/`DateRangeSelector` del Design
System de Fase 10, estética dark/red intacta. `AuditTrailPage.jsx`
(nuevo, `/auditoria`, ítem de menú visible solo para ADMIN bajo
"Configuración" — más restrictivo que "Niveles de Acceso", que un
Contador delegado también puede ver): 2 pestañas internas (mismo
patrón `.module-tab` ya usado por `MovementsPage`/`FiscalBooksPage`)
— "Bitácora" (filtros de entidad/acción/rango de fechas vía
`DateRangeSelector`, detalle expandible con antes/después en JSON) y
"Trabajos Automáticos" (los 9 jobs con su última corrida, duración y
`StatusSeal` de resultado — la UX simple que pide la sección 24: un
Administrador ve "Exitosa"/"Con error", no el mecanismo interno). La
UX de aprobaciones (sección 22) ya existía y no se tocó — `Payment
OrdersPage` ya muestra exactamente el patrón pedido (proveedor/monto/
solicitante/estado con botones Aprobar/Rechazar simples).

### Tests (sección 25) — 648/648 sin regresiones (611 previos + 37 nuevos)

- `core/workflow/segregation.rules.test.js` (3 tests): la función
  compartida nueva.
- `core/jobs/job-run.service.test.js` (4, mockeado) +
  `job-run.integration.test.js` (2, Postgres real: aislamiento
  multiempresa, filtros de `listRuns`).
- `core/audit/audit.service.test.js` (3, Postgres real: filtro
  `action`, tope de `limit`, aislamiento multiempresa).
- `treasury/payment-order-approval-alerts.integration.test.js` (4,
  Postgres real): envío a aprobación crea la alerta de nivel 1;
  aprobar un nivel intermedio cierra esa alerta y crea la del
  siguiente; rechazar cierra todas; completar todos los niveles
  (APPROVED) cierra todas; cancelar cierra todas; `createAlertIfNotExists`
  no duplica en una segunda llamada con el mismo `entityId`.
- Las 3 suites existentes de maker-checker (`payment-approval.rules.
  test.js`, `petty-cash-approval.rules.test.js`, `physical-count.rules.
  test.js`) siguen pasando **sin modificarlas** — confirma que la
  consolidación no cambió ningún mensaje ni código de error.
- `ledger.transaction.integration.test.js`/`period-lock.rules.test.js`
  siguen pasando tal cual, confirmando que el fix de TOCTOU no rompió
  el comportamiento normal (asiento válido sigue posteando, periodo
  cerrado sigue rechazando).

### E2E / verificación real (sección 26)

Contra Postgres real con los 2 servidores levantados y los 4 usuarios
del seed (ADMIN/ACCOUNTANT/FINANCE/COLLABORATOR):
- `POST /auth/login` (ADMIN) → `GET /jobs/status` (200, catálogo real
  de 9 jobs) → `GET /audit-log?limit=3` (200, eventos reales con
  `oldValue`/`newValue` completos).
- Colaborador → `GET /audit-log` (403) y `GET /jobs/status` (403).
- ADMIN → `GET /accounting/audit-log` (404, confirma que la ruta vieja
  se movió limpio, no quedó duplicada).
- Sin token → `GET /audit-log` (401).
- El ciclo completo de aprobación (crear → enviar → aprobar nivel 1 →
  aprobar nivel 2 → alertas cerradas) y el de rechazo se verificaron
  contra Postgres real dentro de la suite de integración nueva
  (`payment-order-approval-alerts.integration.test.js`), con las
  mismas aserciones que pedía la sección 26 (alerta de nivel 1 creada,
  cerrada al aprobar, alerta de nivel 2 creada, todo cerrado al
  rechazar/aprobar del todo/cancelar) — no se repitió el mismo flujo
  una segunda vez a mano por Playwright, ya que la prueba de
  integración cubre exactamente el mismo camino contra la misma base
  de datos real, con aserciones más precisas de lo que un recorrido
  visual podría confirmar.

### Regresiones (sección X)

648/648 tests de backend (0 regresiones); `npm run lint` backend: 0
errores/warnings (se limpió además un warning nuevo de directive
`eslint-disable` innecesaria en el propio test agregado); frontend
`npm run build`/`npm run lint`: sin errores nuevos (mismo baseline de
8 warnings `only-export-components` preexistentes).

### Performance (sección 27)

`auditService.listForCompany` y `jobRunService.listRuns` llevan tope
duro (1000/500 filas respectivamente) desde el día uno, nunca sin
límite. `runJob` agrega exactamente 1 `INSERT` por corrida de job (9
jobs, corridas diarias/mensuales) — irrelevante en volumen. No se
introdujo ningún middleware nuevo que corra en cada request (las rutas
nuevas son de solo lectura administrativa, poco tráfico, sin impacto
en el resto del sistema). No se detectó ningún N+1 nuevo: `listForCompany`/
`listRuns`/`getLastRunsByJob` son consultas `findMany` directas, sin
bucles con consultas dentro.

### Archivos modificados/creados (sección Y)

**Nuevos**: `src/core/workflow/segregation.rules.js` (+test),
`src/core/jobs/{job-registry,job-run.service,jobs.controller,
jobs.routes}.js` (+2 tests), `src/core/audit/{audit.controller,
audit.routes,audit.service.test}.js`,
`src/modules/treasury/services/payment-order-approval-alerts.
integration.test.js`, `frontend/src/api/audit.js`,
`frontend/src/pages/audit/AuditTrailPage.jsx`.

**Modificados**: `prisma/schema.prisma` (enum `AlertType` +
`APPROVAL_PENDING`, modelo `JobRun` + enum `JobRunStatus`,
`Company.jobRuns`), `src/core/period-lock/period-lock.service.js`
(TOCTOU), `src/core/ledger/ledger.service.js` (TOCTOU),
`src/core/alerts/alert-type.js`, `src/core/account/services/
notifications.service.js` (label), `src/core/account/services/
activity.service.js` (límite explícito), `src/modules/treasury/
services/{payment-approval.rules,petty-cash-approval.rules,
payment-orders.service}.js`, `src/modules/inventory/services/
physical-count.rules.js`, `src/modules/accounting/routes/index.js`
(ruta vieja retirada), `src/app.js` (2 rutas nuevas montadas),
`frontend/src/config/alertLinks.js`, `frontend/src/App.jsx`,
`frontend/src/components/AppLayout.jsx`. **Eliminados**:
`src/modules/accounting/{routes/audit.routes.js,controllers/audit.
controller.js}` (reemplazados por la versión neutral en `core/audit`).

### Migraciones (sección Z)

`20260924234818_fase11_workflow_jobs` — aplicada con `prisma migrate
dev` (el entorno sí lo permitió esta vez, sin interacción). Aditiva:
un valor nuevo de enum (`AlertType.APPROVAL_PENDING`), un modelo nuevo
(`JobRun`) y su enum (`JobRunStatus`). Ningún modelo existente perdió
ni cambió un campo.

### Dependencias (sección AA)

Ninguna nueva. Se evaluó explícitamente `cron-parser` (para calcular
"próxima ejecución" exacta de cada job) y se descartó — un texto
simple ya cubre el caso de uso con 9 jobs de horario fijo, documentado
como límite consciente en `job-registry.js`.

### Riesgos pendientes / deuda técnica (sección AC)

1. El TOCTOU de periodo se mitigó (ventana mucho más chica), no se
   eliminó por completo a nivel de aislamiento de transacción — un
   bloqueo explícito (`SELECT FOR UPDATE`) quedaría para una fase
   futura si se detecta un caso real de doble escritura concurrente.
2. `core/alerts` (incluida la alerta nueva `APPROVAL_PENDING`) sigue
   sin participar del Unit of Work (Fase 1) — se crea/cierra
   DESPUÉS de que la transacción de negocio ya confirmó, no dentro de
   ella. Es un best-effort de notificación (documentado explícito en
   el propio código), no un dato contable: si fallara, la orden de
   pago ya quedó bien guardada, solo faltaría el aviso. Generalizar
   `core/alerts` para aceptar un cliente transaccional (mismo patrón
   ya usado en Ledger/Audit) es una mejora real pero se dejó fuera de
   alcance — tocar un motor compartido por 6+ módulos solo para este
   caso no se justificaba bajo el mandato explícito de "no crear
   motores paralelos ni rediseños innecesarios".
3. Permisos granulares por acción (sección 7) evaluados y
   deliberadamente no construidos de forma genérica — documentado como
   decisión, no como trabajo pendiente.
4. La deuda técnica heredada de Fase 10 (consolidación de Botón/Modal,
   responsive de contenido interno, rediseño de Venta Rápida) no se
   tocó — ninguna tenía dependencia directa con esta fase, tal como
   exige la sección 29.

### Pendientes heredados (sección AD)

Los ya documentados en Fases 0-10 (Botón/Modal sin consolidar,
responsive interno pendiente, Venta Rápida sin rediseño de flujo) — sin
cambios en esta fase.

### Pendientes para Fase 12 (sección AE)

- Si aparece un caso de negocio real que lo justifique: permisos
  granulares por acción (ej. "aprobar" vs. "crear" en un módulo
  distinto de Tesorería) o un bloqueo pesimista real para el TOCTOU de
  periodo.
- Conectar `core/alerts` al Unit of Work si aparece un segundo caso de
  uso donde "la alerta se cree siempre o nunca junto con la operación"
  sea un requisito real, no solo deseable.
- Exportación de la bitácora general (PDF/Excel), reutilizando
  `core/utils/exporters` ya existente — no se pidió explícito en esta
  fase, la pantalla nueva es de solo consulta.

### Estado de `PROGRESS_LOG.md` (sección AF)

Actualizado con esta sección; el historial de Fases 0-10 no se tocó.

### Estado final (sección AG)

FASE 11 COMPLETA. RBAC/permisos/aprobaciones/workflows/auditoría
auditados sin crear motores paralelos; 2 hallazgos reales corregidos
(TOCTOU de periodo en `core/ledger`, alertas de aprobación pendiente
inexistentes); 1 duplicación real consolidada (segregación de
funciones, 3 → 1); 1 pieza faltante construida de forma mínima
(`core/jobs`, respondiendo a la sección 17); bitácora de auditoría
general movida a una ruta neutral y expuesta por primera vez en el
frontend. 648/648 tests, 0 regresiones, build/lint limpios en ambos
lados. No se inicia Fase 12 automáticamente.

---

## Fase 12 — Inteligencia, Automatización y Decisión

**Estado: FASE COMPLETA**

### Principio aplicado (sección 2)

`REGLA SIMPLE → AUTOMATIZACIÓN → MODELO/FORECAST → IA`. Todo lo
construido en esta fase se quedó en el primer escalón (reglas
determinísticas puras sobre datos ya calculados) — no se llegó a
necesitar automatización nueva más allá de agrupar un escaneo en un
job ya existente, ni un modelo estadístico nuevo, ni IA generativa. No
es una limitación: es el resultado de evaluar honestamente que los
problemas reales encontrados (sección E de abajo) se resuelven del
todo con reglas simples sobre servicios que ya existen.

### Auditoría inicial (secciones 3-4)

Se leyó `PROGRESS_LOG.md` completo (Fases 0-11), se auditaron
`core/alerts`, `core/events`, `core/jobs` (Fase 11), `modules/finance`,
`modules/fpa`, `modules/reports` (incluido `dashboard.service.js`,
`aging.service.js`), `modules/advanced-analytics`, `modules/business-metrics`.

**Hallazgo central de la auditoría**: Alarfly **ya tiene** una capa de
inteligencia real y madura, construida en fases de features previas a
la numeración de Fases — el módulo **Análisis Avanzados**. Cada uno de
sus 16 tipos de análisis (Horizontal, Vertical, Razones Financieras,
Presupuesto vs. Real, DuPont, Riesgo y Apalancamiento, Predictivo,
etc.) está OBLIGADO por diseño a archivar 6 partes: resultado numérico,
tipo de gráfico, **causa**, **interpretación simple**, metodología y
**sugerencias cuantificadas** — el motor rechaza en tiempo de ejecución
cualquier resultado con una parte vacía. Esto es, literalmente,
DETECCIÓN + EXPLICACIÓN + RECOMENDACIÓN (secciones 7.A-D del prompt
oficial) ya construido, ya auditado, ya probado, ya con su propio job
automático (`advanced-analytics.automation`, envuelto en `core/jobs`
desde Fase 11) que dispara `ADVANCED_ANALYSIS_ALERT` cuando un
resultado cruza una condición configurada. **F12 no debía duplicar
esto** — y no lo hizo.

Lo que la auditoría sí encontró como vacío real: ninguna pantalla
mostraba una "tarjeta" contextual con evidencia + recomendación en el
momento y lugar donde más importa (el Inicio) — el widget "Requiere tu
atención" solo repetía el mensaje de una `Alert` de una línea, sin el
"por qué" ni los números que lo sustentan (exactamente el ejemplo de
la sección 8: "no mostrar simplemente otro KPI").

### Mapa de capacidades inteligentes existentes (sección C/D)

| Capacidad | Fuente | Qué produce | Reutilizado en F12 |
|---|---|---|---|
| Análisis Avanzados (16 tipos) | `modules/advanced-analytics` | Detección + causa + interpretación + sugerencias, archivado y auditable | Sí — documentado como ya-completo, no tocado |
| Finance Summary | `modules/finance/services/finance-summary.service.js` | Caja, CxC vencido, CxP, deuda, forecast (primera semana negativa) | **Sí** — fuente directa del Insight de Liquidez |
| Antigüedad de Saldos | `reports/services/aging.service.js` | Saldo por cliente/proveedor, balde de días de atraso | **Sí** — fuente directa del Insight de Cobranza |
| Previsión de Liquidez | `treasury/services/liquidity-forecast.service.js` | 8 semanas, primera semana negativa | Reutilizado vía Finance Summary (no se llamó dos veces) |
| KPIs (EBITDA/Burn/Runway) | `fpa/services/kpis.service.js` | 3 métricas | Auditado, no se necesitó para esta fase |
| Presupuesto vs. Real | `fpa/services/budget-variance.service.js` | Desviación + justificación | Ya cubierto por Análisis Avanzados, no duplicado |
| Motor de alertas | `core/alerts` | 12 tipos de alerta (10 previos + `APPROVAL_PENDING` de F11 + `LIQUIDITY_RISK_FORECAST` nuevo) | **Extendido** con 1 tipo nuevo, mismo motor |
| `core/events/eventBus.js` | — | Sin usar (documentado 3 veces ya en fases previas) | Sin cambios — no se inventó un evento nuevo (sección 11) |
| `core/jobs` (Fase 11) | — | 9 jobs con seguimiento de corridas | Reutilizado: el escaneo nuevo se agrupó en el job diario de Tesorería ya existente, no se creó un cron nuevo |

### Detección, Insights y Explicaciones (secciones E-G)

Se construyó `modules/reports/services/insights.{rules,service}.js`
(nuevo, mínimo): dos insights, elegidos por ser exactamente los dos
ejemplos más desarrollados del propio prompt oficial (secciones 8, 10,
24, 25) y por tener una fuente de datos 100% trazable sin inventar
ningún cálculo nuevo:

1. **Insight de Liquidez**: reutiliza `financeSummaryService.
   getFinanceSummary` (caja disponible, CxC vencido, primera semana
   negativa — los 3 campos, sin volver a sumarlos). Si no hay ninguna
   semana proyectada en negativo, devuelve `null` — nunca inventa una
   alerta sin evidencia (sección 15). Severidad CRITICAL si la semana
   negativa cae en 14 días o menos, WARNING si cae más adelante en el
   horizonte — reutiliza los 3 niveles de `AlertSeverity` que ya
   existen (sección 9: "no crear otra taxonomía"), nunca una escala de
   5 niveles nueva. El texto usa lenguaje no causal cuando la relación
   no está demostrada ("esto coincide con", nunca "esto es causado
   por" — sección 15, letra explícita del prompt).

2. **Insight de Cobranza**: reutiliza `aging.service.
   getReceivablesAging` (misma fuente que Reportes > Antigüedad de
   Saldos). Ordena los clientes con saldo vencido por monto, muestra
   el top 3 con su balde de días real — **no fabrica** un "promedio
   histórico de días de pago" (aunque el ejemplo de la sección 24 lo
   sugiere) porque ese dato no existe como cálculo real y consistente
   en el sistema; se documentó explícitamente esta omisión en vez de
   inventar un número (sección 15, principio explícito de la fase).

Cada insight responde, como campos propios del objeto que devuelve,
las 4 preguntas de la sección 19 (QUÉ DETECTÓ → `title`/`description`;
CON QUÉ DATOS → `evidence[]`; POR QUÉ IMPORTA → `severity`; QUÉ
RECOMIENDA → `action`) y declara su propia fuente (`source`) para
trazabilidad.

### Forecast (sección H)

Auditado: la Previsión de Liquidez (F1-F8, 8 semanas reales) sigue
siendo el único forecast de caja del proyecto — no se creó un segundo.
Se confirma que el sistema ya distingue REAL (Ledger)/BUDGET
(`Budget`/`BudgetLine`)/FORECAST (Previsión de Liquidez, KPIs
proyectados)/SIMULATION (What-If, FP&A) como categorías separadas y
etiquetadas en sus propias pantallas — ninguna se mezcló ni se tocó.

### Recomendaciones (sección I)

Cada insight trae `action: {label, to}` — un enlace directo a la
pantalla real donde se resuelve (`/cuentas/cobros`,
`/cuentas/clientes`), nunca un botón que ejecute algo — Nivel 1/2 de
automatización (sección 13: "solo informar"/"proponer"), nunca Nivel
4-5.

### Automatizaciones (sección J) — Nivel 1 aplicado, Niveles 4-5 explícitamente evitados

Se agregó un único punto de automatización real: `insightsService.
scanLiquidityRisk(companyId)` — la MISMA detección del insight de
liquidez, pero además sube una alerta real al motor central si no hay
una ya activa (Nivel 1, "solo informar" — sección 13). Se agrupó
dentro del job diario **ya existente** de Tesorería
(`treasury.alerts-scan`, `alerts.cron.js`), en vez de crear un cron
nuevo (sección 12, mandato explícito). No se automatizó ninguna acción
financiera (pago, transferencia, asiento, cambio fiscal) de forma
autónoma — prohibido explícito de las secciones 13/45, respetado sin
excepciones.

**Decisión de arquitectura documentada**: `insightsService.
scanLiquidityRisk` vive en `modules/reports` (junto al resto de
`insights.service.js`), pero se invoca desde `modules/treasury/
services/alerts.cron.js` en vez de desde `treasury/services/
alerts.service.js`. Motivo: `modules/reports` ya depende de
`modules/treasury` (vía `finance-summary.service`/`liquidity-forecast.
service`); si `treasury` importara de vuelta a `reports` se crearía una
dependencia circular entre esos dos módulos de servicio. El archivo de
composición del cron (que ya no es un servicio de un módulo, es el
punto donde se arma el trabajo del día) es el lugar correcto para
juntar ambos sin crear el ciclo.

### Alertas inteligentes (sección K)

Nuevo tipo `LIQUIDITY_RISK_FORECAST` en el enum `AlertType` compartido
(igual patrón que los 11 tipos anteriores — actualizado en los 4
puntos que ya lo centralizan: `schema.prisma`, `core/alerts/alert-type.js`,
`ALERT_TYPE_LABELS` de Mi Cuenta > Notificaciones, `alertLinks.js` del
frontend — la "lección repetida" ya documentada 3 veces en el proyecto
sobre mantener estos 4 puntos sincronizados). `entityType: 'Company'`
(no una cuenta puntual, porque el riesgo es de toda la empresa) —
precedente nuevo pero consistente con el modelo `Alert` ya existente.
Deduplicación automática vía `createAlertIfNotExists` (el mismo motor
de siempre, sin excepción).

### Jobs (sección L)

`core/jobs` (Fase 11) reutilizado tal cual — el nuevo escaneo de
liquidez se agrupó en el job `treasury.alerts-scan` en vez de crear un
`liquidity-risk.cron.js` aparte (sección 12). El resultado del job
ahora incluye `liquidityRisk` junto a los 5 escaneos que ya traía.

### Eventos (sección M)

`core/events/eventBus.js` auditado de nuevo: sigue sin usarse en todo
el proyecto (documentado la 4ª vez). No se inventó ningún evento nuevo
para conectar esta fase — la arquitectura de "llamada directa" que ya
usa el resto del proyecto (sección 11 lo permite: "operacionales/
financieros/analíticos" pueden resolverse sin el bus si no hay un caso
real que lo necesite) fue suficiente.

### Dashboard (sección N)

`dashboard.service.js` (Fase 9) ganó 2 widgets nuevos
(`liquidity_insight`, `collections_insight`), mismo registro y mismo
mecanismo de RBAC por rol server-side (`roles: ['ADMIN','ACCOUNTANT',
'FINANCE']`, verificado en vivo con `curl`: un Colaborador nunca
recibe estos 2 widgets en la respuesta). `AttentionSection` (Inicio)
ahora renderiza estos insights como tarjetas más ricas (evidencia +
acción) por encima de la lista simple de alertas — sin crear un
componente nuevo tipo "InsightCardPremium" (sección 43, prohibido
explícito): es la misma `.dashboard-attention-card`/`Button` de
siempre, con más contenido adentro. `ExecutiveDashboardPage.jsx`
(Reportes > Tablero Ejecutivo) ganó el mismo par de casos de
renderizado, mismo patrón ya usado para los widgets de F9/F11.

### Asistente de IA generativa (secciones O-P) — evaluado, NO construido

Se evaluó explícitamente conforme al árbol de decisión de la sección 2
y el checklist de la sección 50. Conclusión: **no se justifica
construir un asistente conversacional con LLM en esta pasada**, por
las siguientes razones documentadas:

1. El proyecto no tiene hoy ninguna integración con un proveedor de
   LLM — agregar una implicaría una decisión de costo/proveedor/
   privacidad de datos que el prompt mismo (sección 31) exige
   documentar "qué datos salen, cuándo, por qué, bajo qué
   configuración" ANTES de integrar, y es una decisión que le
   corresponde al dueño del producto, no una que deba tomarse dentro
   de una fase de auditoría/consolidación.
2. Las preguntas de ejemplo de la sección 14 ("¿cuánto tengo por
   cobrar?", "¿cuáles son mis clientes más atrasados?") **ya tienen
   una respuesta exacta y verificable** en el sistema actual (Finance
   Summary, Antigüedad de Saldos, los 2 insights nuevos) — el valor
   marginal de envolverlas en lenguaje natural es de conveniencia de
   interfaz, no de capacidad nueva, y no justifica el costo/riesgo de
   integrar un LLM todavía.
3. Construir el "orquestador" (sección 15-17: LLM nunca es la fuente
   de verdad, siempre pasa por herramientas autorizadas que respeten
   RBAC) es, en sí mismo, una pieza de infraestructura considerable —
   construirla sin un LLM real conectado detrás sería trabajo
   especulativo, contrario al principio de la fase ("no crear una IA
   simplemente porque la fase se llama Inteligencia").

**Trabajo preparatorio, documentado y no implementado** (sección 16,
"herramientas del asistente" — catálogo conceptual para una fase
futura, sin wiring real): `getFinanceSummary` (`finance-summary.
service.getFinanceSummary`), `getCashPosition` (`treasury-accounts.
service.getConsolidatedCashPosition`), `getReceivablesAging`/
`getPayablesAging` (`reports/aging.service`), `getLiquidityForecast`
(`liquidity-forecast.service`), `getBudgetVariance` (`fpa/
budget-variance.service`), `getAlerts` (`core/alerts.listAlertsForUser`),
`getLiquidityInsight`/`getCollectionsInsight` (los 2 nuevos de esta
fase). Cada una ya existe, ya es READ-only, ya respeta `companyId` de
la sesión — el día que se decida construir el asistente, la capa de
herramientas es literalmente "envolver estas funciones con nombre y
descripción", sin tener que auditar de nuevo qué es seguro exponer.

### Seguridad, RBAC, Multiempresa (secciones Q-S)

Los 2 widgets nuevos heredan el filtrado server-side de
`dashboard.service.js` (Fase 9) sin ningún código nuevo de permisos —
confirmado con `curl` que un Colaborador nunca recibe `liquidity_insight`/
`collections_insight` en la respuesta. `insightsService.
getCollectionsInsight`/`getLiquidityInsight` reciben siempre
`companyId` de `req.auth.companyId` (mismo patrón que el resto del
proyecto) — probado con una prueba de integración dedicada (aislamiento
multiempresa: la factura vencida de una empresa nunca aparece en el
insight de otra). `scanLiquidityRisk` también aislado por empresa
(probado).

### Privacidad (sección T)

No aplica en esta fase — no se integró ningún proveedor externo, no
sale ningún dato de la infraestructura propia del proyecto.

### Costos (sección U)

Cero costo de API nuevo (no hay LLM). El único costo agregado es 1
consulta más por escaneo diario (`scanLiquidityRisk`, agrupado en el
job ya existente) y el cálculo de 2 widgets más en cada carga del
Dashboard — ambos reutilizan consultas que YA se hacían para otros
widgets (`finance_summary` ya calculaba lo mismo que necesita
`liquidity_insight`); el costo marginal real es mínimo.

### Performance (sección V)

Los 2 insights se calculan de forma síncrona dentro de
`GET /reports/dashboard` (mismo patrón que el resto de widgets, sin
caché ni precómputo) — aceptable porque reutilizan datos que ya se
calculaban para otros widgets de la misma respuesta, no agregan una
consulta pesada nueva. No se ejecuta nada parecido a un LLM en cada
carga del Dashboard (sección 42, prohibido explícito) porque no existe
ningún LLM en esta fase.

### Tests (sección W)

13 tests nuevos (661/661 total, 0 regresiones): 7 de `insights.rules.
test.js` (liquidez null sin evidencia, severidad CRITICAL/WARNING,
cobranza null sin vencidos, orden y límite top-N, severidad del peor
caso, total sobre TODOS los vencidos no solo el top-N mostrado), 4 de
`insights.service.integration.test.js` (Postgres real: null en el caso
feliz, factura vencida real detectada con evidencia trazable,
aislamiento multiempresa), 2 de `liquidity-risk-scan.integration.test.js`
(Postgres real: sin alerta si no hay riesgo, alerta real creada +
segunda corrida no duplica).

### E2E (sección X)

Contra Postgres real con los 2 servidores levantados: login ADMIN →
`GET /reports/dashboard` → confirma que `liquidity_insight`/
`collections_insight` están presentes en la respuesta (null en el
estado actual del seed, correctamente — no hay riesgo de liquidez ni
facturas vencidas en ese momento, el sistema no inventa nada); login
Colaborador → confirma que NINGUNO de los 2 widgets aparece en su
respuesta (RBAC server-side real, no solo frontend). El camino
positivo (insight con datos reales, alerta creada) se verificó con
pruebas de integración contra Postgres real en vez de repetirlo a mano
por Playwright — mismo criterio ya usado en Fase 11, exactamente el
mismo camino de código con aserciones más precisas.

### Regresiones (sección Y)

661/661 tests backend, 0 regresiones (648 previos + 13 nuevos).
`npm run lint` backend: 0 errores/warnings. Frontend `npm run build`/
`npm run lint`: sin errores nuevos (mismo baseline de 8 warnings
`only-export-components`).

### Archivos modificados/creados

**Nuevos**: `src/modules/reports/services/insights.{rules,service}.js`
(+3 archivos de test), `src/modules/reports/services/
liquidity-risk-scan.integration.test.js`.

**Modificados**: `prisma/schema.prisma` (`AlertType.
LIQUIDITY_RISK_FORECAST`), `src/core/alerts/alert-type.js`,
`src/core/account/services/notifications.service.js`,
`src/modules/reports/services/dashboard.service.js` (2 widgets
nuevos), `src/modules/treasury/services/alerts.cron.js` (agrupa el
nuevo escaneo), `frontend/src/config/alertLinks.js`,
`frontend/src/pages/DashboardPage.jsx` (+.css, `InsightCard`),
`frontend/src/pages/reports/ExecutiveDashboardPage.jsx`.

### Migraciones

`20260925001648_fase12_intelligence_liquidity_alert` — aditiva, un
solo valor de enum nuevo (`AlertType.LIQUIDITY_RISK_FORECAST`). Ningún
modelo existente cambió.

### Dependencias

Ninguna nueva (ni librería de forecasting/ML ni SDK de ningún
proveedor de IA).

### Riesgos (sección AC)

1. `entityId: companyId` en la alerta de liquidez es un precedente
   nuevo (alerta a nivel de toda la empresa, no de una entidad
   puntual) — si en el futuro se necesita más de un tipo de alerta
   "de empresa completa", conviene revisar si `entityType: 'Company'`
   sigue siendo la convención correcta o si merece su propio patrón.
2. El Insight de Cobranza no incluye "promedio histórico de días de
   pago" (mencionado en el ejemplo de la sección 24) a propósito — si
   se pide ese dato explícitamente, hay que decidir CON el usuario qué
   cálculo real lo respalda antes de mostrarlo (nunca inventarlo).
3. La severidad de una alerta `LIQUIDITY_RISK_FORECAST` ya creada no
   se actualiza si la situación empeora de WARNING a CRITICAL mientras
   sigue activa — mismo comportamiento ya existente en el resto de
   tipos de alerta del proyecto (ninguno se "actualiza en el sitio"),
   no es una regresión nueva de esta fase.

### Deuda técnica (sección AD)

Ninguna nueva introducida por esta fase. La deuda heredada de F10/F11
(Botón/Modal sin consolidar, responsive interno, TOCTOU residual de
periodo) sigue sin tocar — sin dependencia directa con F12.

### Pendientes para Fase 13 (sección AF)

- Asistente de IA generativa: evaluado y deliberadamente diferido (ver
  sección O-P arriba) — el catálogo de herramientas ya está
  documentado y listo si se decide construirlo, con aprobación
  explícita del usuario sobre proveedor/costo/privacidad primero.
- Insights adicionales (margen, inventario, concentración de
  clientes/proveedores) — evaluados en la auditoría, no construidos en
  esta pasada por alcance; el patrón (`insights.rules.js` +
  `insights.service.js`, funciones puras + wrapper de I/O) ya queda
  listo para extenderse sin rediseñar nada.
- Resúmenes automáticos diarios/semanales/mensuales (sección 28):
  evaluados, no construidos — se apoyarían en `ScheduledReport` (ya
  existente) sin necesitar un motor nuevo, pero no había un caso de
  uso confirmado por el usuario en esta fase.

### Estado de PROGRESS_LOG.md

Actualizado con esta sección; historial de Fases 0-11 intacto.

### Estado final

FASE 12 COMPLETA. Se auditó la inteligencia existente (hallazgo
central: Análisis Avanzados ya cubre gran parte de la taxonomía
pedida, no se duplicó). Se construyeron 2 insights deterministas
reales (Liquidez, Cobranza), reutilizando 100% de fuentes ya
existentes, con evidencia trazable y sin inventar ningún dato. Se
agregó 1 alerta nueva conectada al job ya existente (Nivel 1 de
automatización). Se evaluó explícitamente un asistente de IA
generativa y se decidió, con razones documentadas, no construirlo en
esta pasada — quedó preparado conceptualmente para una fase futura.
661/661 tests, 0 regresiones, build/lint limpios. No se inicia Fase 13.

## Rediseño UX/UI Maestro — Etapa 1 (Shell Global)

A pedido explícito del usuario, con un documento maestro subido
(`ALARFLY_MASTER_UX_UI_REDESIGN.md`) y un prompt de implementación con
metodología obligatoria por etapas (auditar → proponer → implementar →
validar → capturar → comparar → corregir → documentar), sin saltar
etapas y sin iniciar la siguiente sin validar la anterior. Esta entrada
cubre solo la Etapa 1 (shell global: sidebar, navegación, topbar,
búsqueda) — las Etapas 2-8 (Inicio, Operaciones, Finanzas, Control,
Analítica, Configuración, responsive/auditoría transversal) quedan
pendientes, no iniciadas.

### Auditoría previa (Paso 1-2)

Se leyó `frontend/DESIGN_SYSTEM.md` completo (paleta, tipografía,
espaciado, componentes) y se inventarió la estructura real del
frontend (rutas de `App.jsx`, `moduleTabs.js`, `AppLayout.jsx`) antes
de tocar código. Hallazgo central: la información arquitectónica de
navegación pedida por el documento maestro (Inicio / Operaciones /
Finanzas / Control / Analítica / Configuración) **ya existía casi
completa** desde la Fase 9 (`NAV_AREAS` en `AppLayout.jsx`, con las 5
áreas ya nombradas) — el shell no necesitaba un rediseño de cero, sino
2 correcciones puntuales y 1 pieza nueva (búsqueda de navegación, que
el documento maestro pide explícitamente en el shell y no existía).

Se evaluó explícitamente colapsar Contabilidad/Tesorería/Cuentas por
Cobrar y Pagar dentro de un único ítem "Finanzas" (como sugiere la
sección 4 del documento maestro) y se decidió NO hacerlo en esta
etapa: harían falta Tarjetas de Crédito, Caja Chica, Conciliación
Bancaria, Notas de Crédito/Débito a Proveedor — ninguna cubierta hoy
por las pestañas de `FinanzasLayout` — así que colapsarlos ahora
habría dejado funcionalidad real huérfana (violaría la regla explícita
de "no remuevas funcionalidad sin investigar su propósito primero").
Documentado como alcance recortado a propósito para una Etapa
posterior (4 o 5), no como algo olvidado.

### Cambios implementados (Paso 3)

1. **Terminología "Panel principal" → "Inicio"**, para que coincida
   con el nombre real del primer ítem del menú y con el vocabulario
   del documento maestro — 8 archivos (`ModuleBreadcrumb.jsx` y 7
   pantallas/tooltips que mencionaban "Panel principal" en texto
   visible al usuario). Ningún comentario de código ni nombre de
   archivo/ruta se tocó, solo strings visibles.

2. **Bug real encontrado y corregido antes de llegar a producción**:
   al mover "Auditoría" al grupo Control (ya lo pedía el documento
   maestro, sección 4), la primera edición dejó un comentario que
   afirmaba el movimiento pero el código seguía empujando `/auditoria`
   a un grupo `Configuración` aparte — detectado releyendo el archivo
   y confirmando con Playwright (`.allInnerTexts()` de cada grupo del
   menú), no confiando en el comentario. Corregido reescribiendo la
   construcción de `NAV_AREAS` con `.map()` para insertar el ítem en
   el grupo `Control` real. Re-verificado: `Control` = [Fiscal,
   Auditoría], `Configuración` = [Niveles de Acceso] — correcto.

3. **Búsqueda de navegación en el topbar** (`NavSearch.jsx`/`.css`,
   nuevo componente + `Icon` nuevo `search`): búsqueda difusa 100% del
   lado del cliente sobre los módulos/submódulos ya listados en el
   menú, reutilizando `utils/fuzzyMatch.js` (ya existente, usado por
   `EntityAutocomplete`) — **cero llamadas nuevas al backend**, cero
   API nueva, cumpliendo la regla explícita de la sección 20 ("no
   crear APIs nuevas solamente para conseguir un efecto visual").
   Atajo de teclado "/" para enfocar (ignorado si el foco ya está en
   un campo de texto), navegación con flechas/Enter/Escape.

4. **Nueva pestaña "Rentabilidad" dentro de Finanzas** (el documento
   maestro la pide explícitamente en esa área, sección 4) — resuelto
   como alias de ruta: `ProfitabilityPage` (ya existente, usada en
   `/reportes/rentabilidad`) se montó también en `/finanzas/
   rentabilidad`, mismo componente, sin duplicar código. Se descartó
   la primera idea (enlazar directo a `/reportes/rentabilidad`) porque
   habría sacado al usuario del árbol de rutas de `FinanzasLayout`,
   rompiendo la continuidad visual de la barra de pestañas/breadcrumb
   — el alias de ruta la preserva.

5. **Bug real de accesibilidad/renderizado encontrado y corregido**
   (el más importante de esta etapa): el mini-panel ("flyout") de un
   módulo con submódulos — mostrado al pasar el mouse o enfocar por
   teclado — **nunca se pintaba en pantalla**, ni con el sidebar
   expandido ni colapsado. Causa raíz: `.app-sidebar` tiene
   `overflow: hidden` y `.app-nav-main` tiene `overflow-x: hidden` —
   el flyout, posicionado con `position: absolute; left: 100%` DENTRO
   de esos contenedores, quedaba recortado por el `overflow` de sus
   ancestros sin importar su `z-index`. El bug es anterior a esta
   etapa (existía desde que se construyó el flyout en una sesión
   previa) y nunca se había detectado porque la verificación de
   entonces solo usó `isVisible()`/bounding box de Playwright — ninguno
   de los dos detecta el recorte de un ancestro con `overflow: hidden`
   (ambos siguen reportando un elemento como "visible" con una caja
   real aunque ningún píxel se esté pintando ahí). Se detectó en esta
   etapa usando `document.elementFromPoint()` en las coordenadas del
   propio flyout, que si refleja lo que realmente se pinta.

   Corregido convirtiendo el flyout a un **portal de React**
   (`createPortal` a `document.body`, `position: fixed` con
   coordenadas reales de `getBoundingClientRect()` del disparador,
   estado de apertura manejado en JavaScript con
   `onMouseEnter`/`onMouseLeave`/`onFocus`/`onBlur` y un retraso de
   150ms al cerrar para permitir que el mouse viaje del disparador al
   panel) en los 3 lugares que ya usaban este patrón: ítems anclados,
   ítems de módulo con submódulos, y "Cerrar sesión". Sin tocar
   ninguna lógica de negocio ni ruta — puramente el mecanismo de
   render del menú.

### Validación (Pasos 4-6)

- **661/661 tests de backend, 0 regresiones** (ningún archivo de
  backend se tocó en esta etapa; corrida como sanity check exigido
  por el documento maestro).
- `npm run build` y `npm run lint` del frontend limpios — mismo
  baseline de 8 warnings preexistentes (`only-export-components` en
  archivos de contexto), 0 warnings/errores nuevos.
- Verificado con Playwright + `document.elementFromPoint()` (no solo
  bounding box) que el flyout ahora se pinta y es clickeable de
  verdad, en sidebar expandido Y colapsado — capturas reales
  revisadas, contenido correcto (`Resumen, Dinero, Cobros, Pagos,
  Cuentas por Cobrar, Cuentas por Pagar, Financiamiento, Liquidez,
  Rentabilidad, Contabilidad Avanzada` para Finanzas).
- Verificado el renombre "Inicio" (1 aparición, 0 restos de "Panel
  principal" en el menú) y la búsqueda de navegación (consulta
  "fiscal" devolvió las 7 pestañas de Fiscal + el módulo mismo,
  agrupadas y rankeadas correctamente).
- Verificada la agrupación completa de las 5 áreas contra la sección 4
  del documento maestro: `OPERACIONES` [Ventas, Inventario],
  `FINANZAS` [Finanzas, Contabilidad, Tesorería, Cuentas por Cobrar y
  Pagar], `CONTROL` [Fiscal, Auditoría], `ANALÍTICA` [FP&A, Reportes,
  Métricas del Negocio, Análisis Avanzados], `CONFIGURACIÓN` [Niveles
  de Acceso] — coincide con la IA pedida, con el recorte ya
  documentado arriba (Contabilidad/Tesorería/CxC-CxP siguen aparte por
  ahora, no fusionados dentro de Finanzas).
- Paleta/tipografía sin cambios (se reutilizaron 100% los tokens ya
  existentes de `theme.css`/`DESIGN_SYSTEM.md` — ningún color, sombra,
  radio o tamaño nuevo).

### Archivos

**Nuevos**: `frontend/src/components/NavSearch.jsx`,
`frontend/src/components/NavSearch.css`.

**Modificados**: `frontend/src/components/AppLayout.jsx` (renombre
"Inicio", fix del grupo Auditoría→Control, portal del flyout, montaje
de `NavSearch`), `frontend/src/components/AppLayout.css` (flyout
`position: fixed` vía portal en vez de `absolute` recortado),
`frontend/src/core/ui/Icon.jsx` (ícono `search`),
`frontend/src/config/moduleTabs.js` (pestaña Rentabilidad en
Finanzas), `frontend/src/App.jsx` (alias de ruta `/finanzas/
rentabilidad`), y 8 archivos con el renombre "Panel principal" →
"Inicio" en texto visible (`ModuleBreadcrumb.jsx`,
`NivelesAccesoPage.jsx`, `MetricsPage.jsx`, `AuditTrailPage.jsx`,
`ArInvoicesPage.jsx`, `TransactionsByTypePage.jsx`, `AccountLayout.jsx`,
`ProfileSection.jsx`).

### Riesgos / deuda técnica documentada

- El bug de recorte del flyout (`overflow: hidden` en ancestros)
  estaba presente desde antes de esta etapa sin haber sido detectado
  — queda como lección documentada: verificar visibilidad real con
  `document.elementFromPoint()`, nunca confiar solo en
  `isVisible()`/bounding box cuando hay overlays posicionados dentro
  de contenedores con overflow recortado.
- Contabilidad/Tesorería/Cuentas por Cobrar y Pagar siguen como ítems
  de sidebar separados de Finanzas (no fusionados) — recorte de
  alcance a propósito, documentado arriba, a revisar en una etapa
  posterior (4 o 5) cuando se audite Finanzas/Control a fondo.

### Estado

**Etapa 1 (Shell global) completa y validada.** No se avanza a la
Etapa 2 (Inicio) sin continuación explícita, tal como exige la
metodología por etapas del documento maestro ("no saltes etapas").

## Rediseño UX/UI Maestro — Etapa 2 (Inicio)

A pedido explícito del usuario, siguiendo la misma metodología
obligatoria por etapas de la Etapa 1 (auditar → proponer → implementar
→ validar funcional → validar visual real → comparar → corregir →
documentar). Esta entrada cubre solo la Etapa 2 (Inicio como Centro
Operativo Inteligente) — las Etapas 3-8 (Operaciones, Finanzas,
Control, Analítica, Configuración, responsive/auditoría transversal)
siguen sin iniciarse.

### Auditoría previa (Paso 1)

Se leyó el código real de `DashboardPage.jsx`/`.css`,
`dashboard.service.js` (Read Layer de widgets), `insights.service.js`/
`insights.rules.js` (Fase 12), `StatCard`/`ModuleCard`/`EmptyState`, y
se tomaron capturas reales del estado actual en 4 anchos (1440/1280/
1024/768) antes de tocar código.

Hallazgo central: la arquitectura funcional que pide esta etapa
(ESTADO → ATENCIÓN → EXPLICACIÓN → ACCIÓN → EVOLUCIÓN, datos desde
fuentes ya existentes, insights con evidencia+acción, personalización
vía `DashboardWidgetPreference`, RBAC server-side por widget) **ya
existía casi completa**, construida en las Fases 9 y 12 — Inicio no
necesitaba un rediseño funcional de cero, sino una revisión de
composición visual y una poda de contenido redundante. Se confirmó
además que `dashboard.service.js` nunca calcula un KPI/saldo por sí
mismo (cada widget llama a un servicio ya existente de Contabilidad/
Tesorería/FP&A/Finanzas/`core/alerts`) y que cada widget declara
`roles` filtrado en el servidor — nada de esto se tocó.

Problemas identificados en la auditoría:
1. Cada bloque de Inicio (Requiere tu atención, Acciones rápidas, 2
   gráficos de tendencia, Previsión de liquidez, Junta) era un
   `<section className="panel">` idéntico, apilado verticalmente sin
   ninguna agrupación conceptual — 6+ cajas con el mismo borde/sombra/
   padding, exactamente lo que el documento maestro pide evitar ("no
   conviertas cada cosa en una tarjeta aislada", "debe sentirse como
   un sistema integrado, no una colección de cards").
2. Al final de Inicio había una grilla de 9 `ModuleCard` ("Módulos")
   — **100% redundante** con la navegación del sidebar ya construida
   en la Etapa 1 (los mismos 9 módulos, con submódulos vía flyout,
   siempre visibles sin scroll). Alargaba la página sin aportar nada
   que el sidebar no resolviera ya mejor.
3. `DashboardPage.css` tenía `box-shadow: var(--shadow-md, ...)` — 
   `--shadow-md` no existe como token (el nombre real es
   `--shadow-elevated`); el valor literal de respaldo enmascaraba el
   error sin que se notara visualmente, pero es una violación real del
   sistema de diseño (un color/sombra fuera de los tokens).
4. No había ningún encabezado explícito para la capa ESTADO (los
   `StatCard` aparecían sueltos debajo del saludo), a diferencia de
   Atención/Acciones, que sí llevaban su propio título — inconsistente
   con el resto de la jerarquía.
5. Responsive: no se encontró ningún bug (el fix de la Etapa 1 al
   sidebar ya resolvía el desborde horizontal por debajo de 1024px);
   el único problema era el alto total de la página (~2940px a
   1440×900), producto de los puntos 1 y 2 de arriba.

### Cambios implementados (Paso 3)

1. **Se agrupan los 3 widgets de evolución** (Ingresos y egresos,
   Comportamiento de ventas, Previsión de Liquidez) bajo un único
   encabezado "Evolución del negocio" — los 2 gráficos de tendencia
   ahora van lado a lado en pantallas anchas (`grid-template-columns:
   repeat(auto-fit, minmax(380px, 1fr))`, el mismo patrón responsive ya
   usado por `.dashboard-stats`/`.dashboard-quick-actions`, sin
   introducir una técnica nueva) y colapsan a una columna en pantallas
   angostas o cuando un rol solo ve uno de los dos (verificado con
   Contador/Colaborador). La Previsión de Liquidez se queda a ancho
   completo debajo (es una tira horizontal de 8 semanas, no calza en 2
   columnas). **Ningún dato ni prop cambió** — siguen siendo
   exactamente `IncomeExpenseChart`/`SalesTrendChart`/
   `LiquidityForecastWidget` con las mismas fuentes de siempre.
2. **Se elimina la grilla "Módulos" (9 `ModuleCard`) de Inicio** — la
   navegación real ya vive en el sidebar desde la Etapa 1. El
   componente `ModuleCard.jsx`/`.css` se deja en el código (no se
   usaba en ningún otro lugar, confirmado con `grep`) por si se
   necesita en otra pantalla más adelante — documentado como deuda
   menor, no crítica.
3. **Se agrega el encabezado "Estado general"** sobre la grilla de
   `StatCard`, mismo tratamiento visual (mayúsculas, `muted`, tracking)
   que ya usan "Requiere tu atención"/"Acciones rápidas"/"Evolución del
   negocio" — hace explícita la jerarquía ESTADO→ATENCIÓN→ACCIÓN→
   EVOLUCIÓN en vez de un orden solo implícito.
4. **Corregido el token de sombra inexistente** (`--shadow-md` →
   `--shadow-elevated`, el real).
5. Limpieza del CSS muerto de `.dashboard-modules-grid` (ya sin uso
   tras el punto 2).

### Bug real encontrado y corregido durante la validación (no en la
auditoría inicial)

Al agregar el encabezado "Estado general" (punto 3), un rol sin
**ningún** widget de esa categoría visible (Colaborador, que no tiene
acceso a ninguno de `finance_summary`/`ebitda`/`burn_rate_runway`)
quedaba con el título "ESTADO GENERAL" flotando sin nada debajo —
`EstadoWidgets` ya devolvía `null` en ese caso, pero el nuevo
encabezado se renderizaba igual. Detectado verificando visualmente con
Playwright los 4 roles reales (no solo Administrador). Corregido con
`hasEstadoWidgets` (mismos 3 `widgetKey` que ya lee `EstadoWidgets`) +
`showEstadoSection`: el encabezado ahora solo aparece si hay algo real
que mostrar debajo (cargando, error, o al menos un widget visible).
Re-verificado con Playwright para Colaborador: la página pasa
directamente del saludo a "Requiere tu atención", sin ningún hueco.

### Validación (Pasos 4-6)

- **661/661 tests de backend, 0 regresiones** (ningún archivo de
  backend se tocó en esta etapa).
- `npm run build`/`npm run lint` del frontend limpios, mismo baseline
  de 8 warnings preexistentes.
- **Validación visual real con Playwright** (no solo DOM/`isVisible()`,
  aprendizaje explícito de la Etapa 1) en 4 anchos (1440/1280/1024/
  768): la página bajó de ~2940px a ~2235px de alto a 1440px de ancho;
  los 2 gráficos de evolución se ven lado a lado en 1440/1280/1024 y
  colapsan correctamente a una columna en 768, sin desborde horizontal
  ni texto cortado en ningún ancho.
- **RBAC verificado en vivo con los 4 roles reales** (no solo
  Administrador): Colaborador (0 tarjetas de Estado, sección Estado
  general ausente, 7 acciones rápidas, solo el gráfico de ventas en
  Evolución), Contador (3 tarjetas, sin Acciones rápidas —
  comportamiento ya existente, sin cambios—, solo el gráfico de
  ingresos/egresos), Financiero (6 tarjetas) — cada uno coincide
  exactamente con `roles` de `dashboard.service.js` y
  `QUICK_ACTIONS`/`SALES_ROLES`/`ACCOUNTING_ROLES` del frontend, sin
  tocar ninguno de los dos.
- **Personalización verificada en vivo**: ocultar el widget EBITDA
  desde "Personalizar Inicio" lo quita de inmediato de la grilla;
  "Restaurar configuración predeterminada" lo trae de vuelta — el
  mecanismo de `DashboardWidgetPreference` sigue intacto.
- **Multi-empresa**: no se tocó ningún filtro de `companyId` (todos los
  widgets del Read Layer siguen recibiendo `companyId` del servidor,
  sin cambios en esta etapa) — verificado por revisión de código, no
  por una prueba en vivo con una segunda empresa (el entorno de
  pruebas solo tiene una empresa demo real; crear una segunda solo
  para esta verificación se consideró un riesgo/alcance innecesario
  para un cambio que no tocó ninguna consulta de datos).
- Menú de "Nueva Venta" (Acciones rápidas) re-verificado con
  `document.elementFromPoint()` tras el cambio de layout — sigue
  pintándose y siendo clickeable de verdad, sin el bug de recorte de
  overflow ya corregido en la Etapa 1.

### Archivos

**Modificados**: `frontend/src/pages/DashboardPage.jsx` (agrupación de
Evolución, encabezado Estado general condicional, eliminación de la
grilla Módulos), `frontend/src/pages/DashboardPage.css`
(`.dashboard-evolution-grid` nuevo, `--shadow-md`→`--shadow-elevated`,
limpieza de `.dashboard-modules-grid` muerto).

**Sin cambios** (ningún archivo tocado): todo el backend, `AppLayout.*`
(Etapa 1, ya validada), `insights.service.js`/`insights.rules.js`
(Fase 12), `dashboard.service.js` (Read Layer), `StatCard`/
`ModuleCard`/`EmptyState`/`JuntaWidget`/`SetupProgressBar` (componentes
compartidos, reutilizados tal cual).

### Riesgos / deuda técnica documentada

- `ModuleCard.jsx`/`.css` quedan sin ningún consumidor en el código —
  no se borraron por si se reutilizan en otra pantalla; si para el
  final del rediseño siguen sin uso, se pueden eliminar.
- La verificación de aislamiento multi-empresa de esta etapa fue por
  revisión de código (ningún filtro de `companyId` se tocó), no por
  una prueba en vivo con 2 empresas reales — documentado explícitamente
  como tal, no como "probado".
- Junta y SetupProgressBar se mantienen con su composición visual
  actual (fuera del alcance explícito de la jerarquía ESTADO→
  ATENCIÓN→ACCIÓN→EVOLUCIÓN que pide esta etapa) — no se identificó
  ningún problema real en ellos durante la auditoría que ameritara
  tocarlos.

### Estado

**Etapa 2 (Inicio) completa y validada.** No se avanza a la Etapa 3
(Operaciones) sin continuación explícita del usuario, tal como exige
la metodología por etapas del documento maestro.

## Rediseño UX/UI Maestro — Etapa 3 (Operaciones)

A pedido explícito del usuario, siguiendo la misma metodología
obligatoria por etapas de las Etapas 1-2 (auditar → mapear → priorizar
→ implementar por bloques → validar funcional → validar visual real →
comparar → corregir → documentar). Esta entrada cubre solo la Etapa 3
(Operaciones: Ventas, Compras, Inventario) — las Etapas 4-8 siguen sin
iniciarse.

### Auditoría inicial (Paso 1) y mapa de pantallas (Paso 2)

Se inventariaron todas las pantallas reales de Operaciones (`grep`/
lectura de código + capturas reales con Playwright en navegador, no
solo DOM):

- **Ventas** (`/ventas/*`): `QuickSalePage` (Venta Rápida),
  `SalesOrdersPage` (Pedidos), `SalesDeliveriesPage` (Entregas).
- **Compras**: no existe un módulo "Compras" separado en el sidebar
  (decisión ya documentada en la Etapa 1: no se fusionó/reorganizó la
  navegación fuera de su propia etapa) — el flujo de compra vive hoy
  repartido en `ApBillsPage` (Facturas de Compra, dentro de Cuentas
  por Cobrar y Pagar) y `PurchaseOrdersPage` (Órdenes de Compra,
  dentro de la pestaña "Órdenes de Compra" de Inventario). Se auditaron
  ambas como las pantallas reales del flujo Compra→Orden→Recepción→
  Factura→Pago.
- **Inventario** (`/inventario/*`): `CatalogPage`, `WarehousesPage`,
  `StockPage`, `MovementsPage`, `TransfersPage`, `PhysicalCountsPage`,
  `PurchaseOrdersPage`, `LotsPage`.

**Auditoría objetiva de componentes** (vía `grep`, no solo lectura
manual): confirmado que `StatusSeal`/`EmptyState` ya se usan en 12 de
las pantallas de Operaciones; que `.btn`/`.btn-primary`/`.btn-small`
(clases de `module.css`) son **visualmente idénticas, token por
token**, a `core/ui/Button` (`.ui-btn`) — comparadas línea por línea,
mismo padding/radio/colores — así que NO es una inconsistencia visual
real, solo dos implementaciones CSS paralelas con el mismo resultado
en pantalla; no se tocó (rehacer esto en 12+ archivos habría sido un
refactor arquitectónico sin beneficio visual, explícitamente prohibido
por el documento maestro).

### Hallazgo central de la auditoría

Contrario a lo que suponía el prompt genérico de esta etapa ("pantallas
que parecen formularios administrativos antiguos"), la auditoría real
—con capturas de pantalla reales, no solo lectura de código— mostró
que **la mayoría de Operaciones ya cumple el lenguaje visual pedido**:
tablas oscuras limpias con `StatusSeal`, estados vacíos con
`EmptyState`, relaciones entre documentos ya visibles (una entrega
muestra el N.º de su pedido, una factura de compra permite facturar
directo desde una orden ya recibida, el stock muestra Existencia/
Reservado/Disponible tal como pide el documento maestro). Esto viene
de que estas pantallas ya se construyeron con el Sistema de Diseño de
la Fase 10, antes de que existiera este rediseño UX/UI.

Se decidió explícitamente **no convertir cada hallazgo en un cambio**
(regla del propio documento maestro, Paso 1: "no conviertas
automáticamente todo hallazgo en un cambio") — el foco real de esta
etapa quedó en la ÚNICA pantalla genuinamente señalada como prioridad
1 y genuinamente por debajo del resto: **Venta Rápida**.

### CONSERVAR / REDISEÑAR / CONSOLIDAR / CORREGIR / NO TOCAR

- **CONSERVAR**: `SalesOrdersPage`, `SalesDeliveriesPage`,
  `ApBillsPage`, `PurchaseOrdersPage`, `StockPage`, `MovementsPage`,
  `TransfersPage` — ya usan `StatusSeal`/`EmptyState`/tablas oscuras
  correctas, ya muestran Existencia/Reservado/Disponible, ya conectan
  documentos relacionados (pedido↔entrega, orden↔factura). No se
  encontró ningún problema real que ameritara un cambio visual.
- **REDISEÑAR**: `QuickSalePage` (Venta Rápida) — todos los campos
  tenían el mismo peso visual, sin distinguir "Buscar/Elegir" de
  "Confirmar" de "Registrar", contradiciendo la sección más detallada
  del propio documento maestro para esta etapa.
- **CONSOLIDAR**: ninguno — no se encontró ningún componente duplicado
  que fuera seguro consolidar sin un refactor mayor (ver `.btn` vs
  `Button` arriba, decidido explícitamente NO tocar).
- **CORREGIR**: un bug real de desborde horizontal en el topbar
  (ver abajo) — transversal a toda la app, no específico de
  Operaciones, pero descubierto y corregido acá por el mismo nivel de
  rigor que exige esta etapa.
- **NO TOCAR**: todo el backend (Ledger, Sales/Purchase/Inventory
  engines, Fiscal, FX, Audit, RBAC, Finance Read Layer) — ningún
  archivo de `src/` (backend) se modificó en esta etapa.

### Cambios implementados (Paso 4, Bloque 1 — Venta Rápida)

1. **Nuevo componente genérico `core/ui/Disclosure.jsx`** (+ `.css`):
   sección de formulario colapsable, sin persistencia (a diferencia de
   `ExecutiveSummaryCards`, que sí recuerda su estado por usuario vía
   `core/panel-preferences` — acá no hace falta, es una sección de
   formulario que casi nunca se toca, no un panel de datos que se
   vuelve a visitar). Mismo glifo ▸/▾ que ya usa `ExecutiveSummaryCards`
   para no introducir un segundo lenguaje visual de colapsar/expandir.
   Se buscó primero si ya existía algo similar (`grep` de "avanzad"/
   `<details>`/"Disclosure" en todo el frontend) — no existía.
2. **`QuickSalePage` reestructurada con revelación progresiva**:
   Jurisdicción fiscal y Cuenta de ingreso (que ya se preseleccionaban
   solas, sin que el código lo ocultara visualmente) ahora viven
   detrás de "Opciones avanzadas", colapsado por defecto — ninguna
   capacidad se pierde, siguen siendo los mismos 2 campos con el mismo
   valor por defecto de siempre. El paso de cobro ("Cobrar de
   inmediato" + cuenta de tesorería + método + monto) se agrupó en su
   propio bloque con borde sutil (`quick-sale-payment-step`), para que
   se sienta como "el paso 2" (Confirmar) en vez de más campos sueltos
   de la misma grilla que Cliente/Productos (Buscar/Elegir). El Total
   se destacó con la tipografía serif que ya usa el resto de la app
   para montos importantes. **Ningún endpoint, payload ni validación
   cambió** — sigue siendo exactamente `POST /sales/quick-sale` con el
   mismo `createInvoice`/`recordPayment` de siempre.

### Bug real encontrado y corregido durante la validación (no en la
auditoría inicial)

Verificando responsive con el mismo rigor que descubrió el bug del
flyout en la Etapa 1 (midiendo `document.documentElement.scrollWidth`
real, no solo revisando capturas de pantalla a ancho fijo — una
captura `fullPage` a un ancho fijo NO revela que el contenido se corrió
más allá del borde derecho, por eso este bug nunca se detectó en las
etapas anteriores), se encontró que **el clúster derecho del topbar**
(selector de moneda, modo incógnito, notificaciones, usuario, cerrar
sesión) **desbordaba horizontalmente por debajo de 900px** —
confirmado que es transversal a TODA la app (Inicio, Contabilidad,
Ventas — no algo introducido por esta etapa ni específico de
Operaciones). Causa: con el sidebar ya angosto (200px) desde ~1024px
(fix de la Etapa 1), el espacio restante no alcanza para la etiqueta
de texto del modo "principiante" de cada ícono + el texto completo de
"Cerrar sesión" + el selector de moneda sin recortar.

Corregido con una nueva media query en `AppLayout.css`
(`@media (max-width: 900px)`): se ocultan las etiquetas de texto del
modo principiante (`.ui-icon-label`) dentro del clúster del topbar, se
oculta el texto "Cerrar sesión" (el botón queda solo con el ícono +
`aria-label` para accesibilidad — se envolvió el texto en un `<span>`
nuevo, `app-topbar-logout-label`, para poder ocultarlo sin tocar el
ícono), se acorta el selector de moneda (`max-width` + elipsis) y se
angosta la búsqueda de navegación. Ningún control deja de funcionar —
todos conservan su `aria-label`/`title`. Re-verificado con Playwright
midiendo `scrollWidth` real en 1440/1280/1024/900/768 en Inicio Y en
Venta Rápida: **0 desbordamiento en los 4 anchos explícitamente
exigidos por el documento maestro** (1440/1280/1024/768).

**Límite documentado, no corregido**: a 480px (móvil real, más angosto
que los 4 anchos obligatorios) el desborde persiste (672px de
contenido en 480px de viewport) — el sidebar no tiene todavía un
patrón de menú fuera de pantalla ("off-canvas") para un ancho tan
angosto, y construir eso es un cambio de arquitectura de navegación
completo (Shell), no un ajuste de CSS puntual. El propio documento
maestro reserva el endurecimiento responsive completo para la Etapa 8
("responsive + auditoría transversal", la última etapa del rediseño) —
se documenta acá como hallazgo real pero deliberadamente diferido a
esa etapa, no ocultado.

### Validación (Pasos 4-6)

- **661/661 tests de backend, 0 regresiones** (ningún archivo de
  backend se tocó).
- `npm run build`/`npm run lint` del frontend limpios, mismo baseline
  de 8 warnings preexistentes.
- **Flujo funcional completo verificado de punta a punta con
  Playwright contra el backend real**: creado un cliente + un
  producto real, Venta Rápida con "Opciones avanzadas" colapsada por
  defecto, expandida al clic (verificado con `document.elementFromPoint`
  que el contenido se pinta de verdad, no solo existe en el DOM),
  venta enviada sin cliente (rechazada correctamente por el backend
  con un mensaje claro — confirma que ninguna validación de negocio se
  rompió), venta enviada con cliente real → `201`, factura N.º 4
  generada por el monto correcto.
- **RBAC re-confirmado sin tocar ningún archivo de permisos**: Colaborador
  llega al contenido real de Venta Rápida (sidebar + ruta accesibles,
  igual que documentado desde que se construyó Fase 3).
- **Responsive validado en los 4 anchos obligatorios** (1440/1280/
  1024/768) + 900 (el punto de quiebre nuevo) con medición real de
  `scrollWidth`, no solo capturas — 0 desbordamiento en todos, tanto
  en Inicio como en Venta Rápida.
- Flyout de navegación (Etapa 1) re-verificado tras tocar
  `AppLayout.css` — sigue pintándose y siendo clickeable de verdad en
  ambos estados del sidebar.

### Ventas, Compras e Inventario (sin cambios de código)

Auditadas a fondo con capturas reales — no se encontró ningún problema
que ameritara un cambio: `SalesOrdersPage`/`SalesDeliveriesPage` ya
muestran `StatusSeal` correcto y relación pedido↔entrega;
`ApBillsPage` ya conecta "Facturar desde una orden de compra ya
recibida"; `StockPage` ya muestra Existencia/Reservado/Disponible +
valoración, exactamente lo que pide el documento maestro; los estados
vacíos (`TransfersPage` sin transferencias) usan `EmptyState`
correctamente. Se avisa explícitamente: esto significa que, salvo
Venta Rápida, el resto de Operaciones **no se tocó** en esta etapa —
no porque se haya saltado, sino porque la auditoría (con evidencia
real, no solo la suposición del prompt) no encontró un problema real
que justificara un cambio.

### Archivos

**Nuevos**: `frontend/src/core/ui/Disclosure.jsx`, `.css`;
`frontend/src/pages/sales/QuickSalePage.css`.

**Modificados**: `frontend/src/pages/sales/QuickSalePage.jsx`
(revelación progresiva), `frontend/src/components/AppLayout.jsx`
(`<span>` nuevo para poder ocultar el texto de "Cerrar sesión" en
angosto), `frontend/src/components/AppLayout.css` (media query nueva
de 900px, bug real de desborde).

**Sin cambios**: todo el backend; `SalesOrdersPage`,
`SalesDeliveriesPage`, `ApBillsPage`, `PurchaseOrdersPage`,
`CatalogPage`, `WarehousesPage`, `StockPage`, `MovementsPage`,
`TransfersPage`, `PhysicalCountsPage`, `LotsPage` — auditadas, sin
cambios porque no se encontró un problema real.

### Riesgos / deuda técnica documentada

- El desborde horizontal a 480px (móvil real) queda documentado y
  diferido a la Etapa 8, que es donde el propio documento maestro
  ubica el endurecimiento responsive completo — no es un descuido, es
  una decisión de alcance explícita.
- No existe hoy un módulo "Compras" unificado en la navegación (el
  flujo vive repartido entre Cuentas por Cobrar y Pagar e Inventario)
  — ya documentado como decisión de la Etapa 1 (no reorganizar
  navegación fuera de esa etapa); Etapa 3 trabajó dentro de esa
  estructura sin crear una segunda navegación, tal como exige
  explícitamente el prompt de esta etapa.
- `.btn`/`Button` (dos implementaciones CSS visualmente idénticas)
  queda como deuda documentada, no corregida — consolidarlas es un
  refactor transversal de bajo valor visual y alto riesgo, reservado
  para la limpieza transversal que el propio documento maestro
  menciona al final del rediseño completo.

### Estado

**Etapa 3 (Operaciones) completa y validada**, con alcance de
implementación real acotado a lo que la auditoría encontró
genuinamente necesario: Venta Rápida rediseñada con revelación
progresiva, y un bug transversal real de responsive corregido. No se
avanza a la Etapa 4 (Finanzas) sin continuación explícita del usuario.

## Rediseño UX/UI Maestro — Etapa 4 (Finanzas)

A pedido explícito del usuario ("continua"), siguiendo la misma
metodología de las Etapas 1-3. Esta entrada cubre solo la Etapa 4
(Finanzas: Resumen, Dinero, Cobros, Pagos, Cuentas por Cobrar/Pagar,
Financiamiento, Liquidez, Rentabilidad, Contabilidad Avanzada) — las
Etapas 5-8 siguen sin iniciarse.

### Auditoría (Paso 1)

Se confirmó primero, leyendo `App.jsx`, que Finanzas es mayormente una
capa de alias sobre pantallas ya existentes de Tesorería/AR-AP/
Reportes (`CashPositionPage`, `ArPaymentsPage`, `ApPaymentsPage`,
`AgingPage`, `DebtsPage`, `LiquidityForecastPage`, `ProfitabilityPage`)
— decisión ya documentada en Fase 5. Solo `ResumenPage` y
`ContabilidadAvanzadaPage` son código propio de Finanzas. Se
capturaron las 10 pestañas reales en navegador antes de tocar código.

**Hallazgo real**: `ResumenPage` (el "home" de Finanzas) mostraba 8
`StatCard` en una sola grilla plana, mezclando posición actual (caja,
disponible, por cobrar, por pagar, financiamiento, comprometido) con
previsión de las próximas 8 semanas (un cálculo distinto, sobre
vencimientos reales) bajo el mismo peso visual — exactamente el mismo
problema REAL-vs-FORECAST ya corregido en Inicio durante la Etapa 2
("Evolución del negocio"). El resto de las pestañas auditadas (Dinero,
Liquidez, Contabilidad Avanzada) ya mostraban jerarquía y agrupación
correctas — sin cambios.

### Cambio implementado (Paso 4)

`ResumenPage` reestructurada en 2 grupos con encabezado propio (mismo
lenguaje visual — mayúsculas, `letter-spacing`, color `muted` — que ya
usan las secciones de Inicio, pero a escala de subgrupo dentro de un
solo panel): "Posición actual" (6 tarjetas) y "Previsión — próximas 8
semanas" (2 tarjetas, con un `HelpTooltip` nuevo aclarando "nunca una
simulación"). Ningún dato, fuente ni cálculo cambió — siguen siendo
los mismos 8 números de `financeApi.getSummary()` de siempre.

### Validación

- **661/661 tests de backend, 0 regresiones** (ningún archivo de
  backend se tocó).
- `npm run build`/`npm run lint` del frontend limpios, mismo baseline.
- Verificado con Playwright: 6 tarjetas en "Posición actual", 2 en
  "Previsión", sin desborde horizontal.
- RBAC re-confirmado sin tocar ningún archivo de permisos: Colaborador
  ve las 8 tarjetas (el módulo `finance` está abierto a los 4 roles en
  `core/rbac/module-access.js`, sin cambios).
- Responsive confirmado a 768px sin desbordamiento (heredando el fix
  transversal del topbar de la Etapa 3).

### Archivos

**Nuevo**: `frontend/src/pages/finance/ResumenPage.css`.
**Modificado**: `frontend/src/pages/finance/ResumenPage.jsx`
(agrupación en 2 secciones, sin tocar la lógica de carga/estado).
**Sin cambios**: todo el backend; `CashPositionPage`/`ArPaymentsPage`/
`ApPaymentsPage`/`AgingPage`/`DebtsPage`/`LiquidityForecastPage`/
`ProfitabilityPage`/`ContabilidadAvanzadaPage` — auditadas, sin
cambios porque no se encontró un problema real.

### Estado

**Etapa 4 (Finanzas) completa y validada**, con el mismo criterio de
alcance de las etapas anteriores: solo se tocó lo que la auditoría
encontró genuinamente necesario. No se avanza a la Etapa 5 (Control)
sin continuación explícita del usuario.

## Rediseño UX/UI Maestro — Etapa 5 (Control)

A pedido explícito del usuario, siguiendo la misma metodología de las
Etapas 1-4. Esta entrada cubre solo la Etapa 5 (Control: Aprobaciones,
Alertas, Conciliaciones, Auditoría, Fiscal, Gobierno) — las Etapas 6-8
siguen sin iniciarse.

### Auditoría (Paso 1) y mapa de pantallas (Paso 2)

Se confirmó primero, per la decisión ya documentada en la Etapa 1, que
Control no tiene navegación propia separada: sus piezas viven dentro
de Tesorería (Órdenes de Pago, Alertas, Conciliación Bancaria) y bajo
`CONTROL` en el sidebar (Fiscal, Auditoría) — no se creó ninguna
navegación nueva. Se auditaron con capturas reales en navegador:
`PaymentOrdersPage` (Aprobaciones), `AlertsPage` (Alertas),
`ReconciliationPage` (Conciliaciones), `AuditTrailPage` (Auditoría),
las 7 pestañas de `FiscalLayout` (Fiscal, 4 de 7 revisadas a fondo:
Transacciones, Reglas de Riesgo, Calendario, Libros — incluida la
sub-pestaña Conciliación fiscal), y `NivelesAccesoPage` + `JuntaWidget`
(Gobierno).

### Hallazgo central de la auditoría

La mayoría de Control ya cumplía el objetivo del documento maestro:
tablas oscuras limpias, `StatusSeal`, `EmptyState`, filtros compactos,
`ViewSwitcher` (Lista/Kanban/Calendario) ya construido para Órdenes de
Pago, Junta ya integrada en Inicio (nunca aislada, como exige
explícitamente esta etapa). Se encontraron **2 problemas reales**,
ambos en los bloques que el propio documento maestro prioriza más
(Aprobaciones y Auditoría):

1. **Auditoría — bug real de legibilidad**: `AuditTrailPage`
   (Bitácora) mostraba `action`/`entityType` tal como los guarda
   `core/audit` internamente — texto técnico crudo tipo
   `ar_invoice.created` y `ArInvoice · cmuhcs39z0025yeogeos5wqzw` — lo
   opuesto de lo que exige el documento maestro para esta etapa ("QUÉ/
   QUIÉN/CUÁNDO/SOBRE QUÉ/QUÉ ACCIÓN" debe entenderse de un vistazo) y
   de la regla explícita de CLAUDE.md contra jerga técnica para un
   usuario sin conocimientos de programación. El mismo problema exacto
   existía en `ActivitySection` (Mi Cuenta > Actividad personal, que
   lee la misma tabla `AuditLog` con un filtro de `userId`).
2. **Aprobaciones — bug real de información faltante**: el detalle
   expandido de una orden de pago mostraba "Aprobaciones registradas"
   con Nivel/Decisión/Comentario, pero **nunca mostraba QUIÉN**
   solicitó la orden ni quién decidió cada nivel — justo la mitad más
   importante de un flujo maker-checker según el documento maestro
   ("APROBACIÓN → quién solicita... aprobar/rechazar"). Investigado:
   el dato de "quién aprobó" ya lo devolvía el backend
   (`approvedByUser`) pero la tabla nunca lo pintaba; el dato de
   "quién solicitó" ni siquiera se pedía en la consulta, aunque la
   relación (`createdByUser`, `PaymentOrderCreatedBy`) ya existía en
   el schema desde que se construyó el modelo.

### Cambios implementados (Paso 4)

**Bloque 1 — Aprobaciones**: se agregó `createdByUser: { select: {
id, name, role } }` al `include` de `payment-orders.service.
getPaymentOrder` (cambio aditivo de una consulta de solo lectura, sin
tocar el schema ni ninguna regla de negocio — la relación ya existía).
En el frontend, `OrderApprovalDetail` ahora muestra "Solicitado por:
{nombre}" y una columna nueva "Decidido por" en la tabla de
aprobaciones (leyendo `a.approvedByUser?.name`, un campo que el
backend YA devolvía antes de este cambio, solo nunca se pintaba).

**Bloque 3 — Auditoría**: nuevo `frontend/src/utils/auditLabels.js`
— capa de TRADUCCIÓN de solo lectura sobre `AuditLog` (nunca un
segundo sistema de auditoría): un mapa de 65 `entityType` (los mismos
modelos Prisma reales, enumerados con `grep` sobre todo el backend) a
sustantivos en español ya usados en el resto de la app, y un mapa de
~50 sufijos de `action` a verbos en español. Cualquier valor que
todavía no esté en el mapa nunca se ve roto — una función
`humanizeToken()` genérica separa palabras en snake_case/PascalCase
como respaldo, mismo criterio de "mejor una traducción genérica que un
texto crudo" ya usado para prevenir el patrón de "enum ampliado,
catálogo desactualizado" documentado varias veces en este archivo.
Conectado en `AuditTrailPage` (columnas Acción/Entidad, con el CUID
completo todavía disponible vía `title` para soporte) y en
`ActivitySection` de Mi Cuenta (mismas columnas, mismo dato).

### Validación

- **661/661 tests de backend cuando se corren en serie
  (`--runInBand`)**. En paralelo (`npm test` normal), un test de
  integración distinto falló en cada corrida (primero
  `sales-orders-deliveries`, después `purchases-ap`, ninguno
  relacionado con el módulo que se tocó en esta etapa) — investigado y
  confirmado como una condición de carrera preexistente entre workers
  de Jest contra el mismo Postgres real (no una regresión de esta
  etapa): ambos pasan solos, y los 661 pasan limpios en serie. Se
  documenta explícitamente en vez de ocultarlo.
- `npm run build`/`npm run lint` del frontend limpios, mismo baseline.
- **Flujo de Aprobaciones verificado de punta a punta contra el
  backend real** (vía API directa): orden creada, `createdByUser`
  confirmado en la respuesta con el nombre real ("Admin Demo"); regla
  de aprobación creada y probada (confirmando además, sin tocar nada,
  que el endpoint de decisión sigue siendo exclusivo de `ADMIN` a
  nivel de ruta — arquitectura ya existente, no modificada); "Solicitado
  por: Admin Demo" confirmado renderizado en la UI real. Datos de
  prueba (2 órdenes, 1 regla) cancelados/desactivados al terminar, sin
  dejar rastro.
- **Traducción de Auditoría verificada en vivo**: "ar_invoice.created"
  se lee "Factura de venta — creado(a)", "inventory_movement.
  exit_created" se lee "Movimiento de inventario — con salida
  registrada", confirmado con capturas reales.
- **RBAC re-confirmado sin tocar ningún archivo de permisos**:
  Administrador ve el enlace "Auditoría" en el sidebar y los datos
  reales; Colaborador y Financiero no ven el enlace, y si navegan
  directo a `/auditoria` el backend los rechaza con "No tienes permiso
  para hacer esta acción" (la tabla nunca llega a pintarse) — la
  autoridad sigue siendo 100% del servidor, nunca solo ocultado en el
  cliente.
- **Multi-empresa**: el cambio en `getPaymentOrder` es aditivo dentro
  del mismo `include`, sin tocar el `where: { id, companyId }` ya
  existente — el aislamiento por empresa no se tocó ni se debilitó.
- Responsive confirmado sin desbordamiento a 768px en Auditoría y
  Órdenes de Pago.

### Archivos

**Nuevo**: `frontend/src/utils/auditLabels.js`.
**Modificados**: `src/modules/treasury/services/payment-orders.
service.js` (1 línea aditiva en un `include`),
`frontend/src/pages/treasury/PaymentOrdersPage.jsx` ("Solicitado por"
+ columna "Decidido por"), `frontend/src/pages/audit/AuditTrailPage.
jsx` (traducción de Acción/Entidad), `frontend/src/core/account/
ActivitySection.jsx` (misma traducción).
**Sin cambios**: `AlertsPage`, `ReconciliationPage`, las 7 pestañas de
`FiscalLayout`, `NivelesAccesoPage`, `JuntaWidget` — auditadas, sin
cambios porque no se encontró un problema real.

### Riesgos / deuda técnica documentada

- El detalle "Ver detalle" (JSON Antes/Después) de la Bitácora de
  Auditoría sigue mostrando nombres de campo técnicos crudos — es una
  vista secundaria/avanzada (jerarquía progresiva: la tabla principal,
  ahora traducida, es la información primaria), y traducir cada campo
  de los 65 modelos sería un trabajo de un orden de magnitud mayor,
  fuera de proporción para este hallazgo puntual — documentado, no
  ocultado.
- La flakiness de tests de integración en paralelo contra Postgres
  real (ver Validación) queda documentada como deuda preexistente del
  entorno de pruebas, no de esta etapa.

### Estado

**Etapa 5 (Control) completa y validada**, con el mismo criterio de
alcance de las etapas anteriores: solo se tocó lo que la auditoría
encontró genuinamente necesario (Aprobaciones y Auditoría), con un
cambio de backend mínimo, aditivo y sin riesgo (un `include` a una
consulta de solo lectura ya existente). No se avanza a la Etapa 6
(Analítica) sin continuación explícita del usuario.

## Rediseño UX/UI Maestro — Etapa 6 (Analítica)

A pedido explícito del usuario, siguiendo la misma metodología de las
Etapas 1-5 y el prompt combinado de Etapas 6/7/8 (ejecución secuencial
obligatoria, una etapa a la vez, con parada e informe antes de
continuar). Esta entrada cubre solo la Etapa 6 (Analítica: FP&A,
Reportes, Métricas del Negocio, Análisis Avanzados) — las Etapas 7-8
siguen sin iniciarse, a la espera de confirmación explícita.

### Auditoría (Paso 1) y mapa de pantallas (Paso 2)

Se auditaron con capturas reales en navegador las 16 pantallas de
Analítica: `FpaLayout` (Dimensiones, Presupuestos, Desviaciones,
Simulador What-If, KPIs), `ReportsLayout` (Estados Financieros, Flujo
de Efectivo, Rentabilidad, Antigüedad de Saldos, Consolidación,
Tablero Ejecutivo, Exportar y Programar), `MetricsPage` (Métricas del
Negocio), y `AdvancedAnalyticsLayout` (Catálogo, Repositorio de
Reportes, Benchmarking). Se verificó además, con una simulación real
(`POST /fpa/scenarios/simulate`), que el Simulador What-If separa con
claridad SALDO BASE (real, sin escenario) de SALDO CON ESCENARIO
(proyectado), incluyendo el aviso de saldo negativo — exactamente la
separación REAL/FORECAST/SIMULATION que exige el documento maestro.

### Hallazgo central de la auditoría

Casi toda Analítica ya cumplía el objetivo del documento maestro:
fuentes de verdad únicas (FP&A y Reportes ya reutilizan los mismos
servicios de Contabilidad/Tesorería sin recalcular nada, documentado
desde hace muchas sesiones en este mismo archivo), `DateRangeSelector`
ya consistente en Estados Financieros/Flujo de Efectivo/Rentabilidad/
Antigüedad/Consolidación/Exportar, catálogo de los 16 Análisis
Avanzados agrupado por categoría con lenguaje simple y sin duplicar
ningún motor de cálculo (Horizontal/Flujo de Efectivo/Rentabilidad/
Presupuesto vs. Real/What-If/Predictivo llaman directo al servicio
original, tal como ya documenta este archivo desde su construcción).
Métricas del Negocio conserva su distinción ya documentada frente a
KPIs de FP&A (número escrito a mano vs. calculado por fórmula).

Se encontró **1 problema real**, en el bloque que el propio documento
maestro señala como zona de riesgo (duplicar información que ya
pertenece a Inicio o Finanzas):

1. **Tablero Ejecutivo — duplicado real de Inicio, con un bug
   agravante**: `ExecutiveDashboardPage` (pestaña "Tablero Ejecutivo"
   de Reportes) usa el mismo `executiveDashboardApi` y por lo tanto la
   misma tabla `DashboardWidgetPreference` (por usuario, no por
   pantalla) que ya usa Inicio — mismo catálogo de widgets, mismas
   preferencias de visibilidad. Sin ninguna capacidad propia, esto era
   un clon sin etiquetar de Inicio dentro de Reportes. Peor: el
   período estaba **fijo y era literalmente imposible de cambiar**
   (`const [range] = useState(...)`, el setter nunca se desestructuró)
   — ni siquiera cumplía el rol mínimo de "reporte consultable para
   cualquier período" que exige el documento maestro para diferenciar
   un reporte de un panel de "ahora".

### Cambios implementados

**`frontend/src/pages/reports/ExecutiveDashboardPage.jsx`**: en vez de
eliminar la pantalla (desproporcionado para un rediseño solo de UX, y
la propia regla de "no eliminar funcionalidad sin demostrar la
duplicación" del prompt maestro exige conservar por defecto), se le
dio la única capacidad que realmente la distingue de Inicio: un
`DateRangeSelector` real y funcional (el mismo componente genérico ya
usado en el resto de Reportes/Auditoría), reutilizando exactamente el
mismo catálogo de widgets y las mismas preferencias — nunca un segundo
Read Layer. Se separó la carga de preferencias de la carga del
tablero (cada una con su propio `isLoading`/`error`), y se agregaron
dos `HelpTooltip` explícitos aclarando la relación con Inicio ("las
preferencias se comparten con Inicio", "a diferencia de Inicio, que
siempre muestra el mes actual, acá puedes consultar cualquier
período"). Así el Tablero Ejecutivo pasa de ser un clon sin etiquetar
de Inicio a ser "el mismo catálogo de widgets, consultable para
cualquier período" — la interpretación honesta de qué distingue un
reporte de un panel operativo, ya usada en Etapa 2 para separar Inicio
(siempre "ahora") del resto.

### Validación

- **661/661 tests de backend en serie (`--runInBand`)**, sin
  regresiones — esta etapa no tocó ningún archivo de backend.
- `npm run build`/`npm run lint` del frontend limpios, mismo baseline
  de 8 warnings preexistentes (`only-export-components` en los
  archivos de contexto). Se encontró y corrigió un `no-unused-vars`
  real (`toIsoDate`, ya no se usaba tras el refactor) antes de dar por
  cerrada la pieza.
- **Verificado de punta a punta con Playwright contra los dos
  servidores reales**: el selector de período se renderiza con sus 7
  atajos, "Año pasado" queda seleccionable y resaltado, y los widgets
  **sí recargan con datos distintos** al cambiar de período (EBITDA
  360,41 US$ → 0,00 US$, Estado de Resultados/Balance General en cero,
  todos coherentes con que no había movimiento hace un año) mientras
  que Posición de Caja Consolidada se mantiene igual (215,00 US$),
  correcto porque es una foto del saldo actual, no un dato por
  período — confirma que la nueva capacidad funciona de verdad, no
  solo visualmente.
- **Responsive confirmado sin desbordamiento horizontal** en las 4
  resoluciones estándar (1440/1280/1024/768px) — a 768px las 7
  pestañas de Reportes envuelven en dos filas limpias, sin recorte.
- **RBAC no se tocó**: `reports` sigue restringido a `ADMIN`/`FINANCE`
  en `core/rbac/module-access.js`, sin cambios — el fix es puramente
  de presentación sobre una pantalla que ya estaba gateada.
- Se revisaron también, sin encontrar ningún problema que ameritara
  cambio: Dimensiones y Presupuestos de FP&A, Estados Financieros,
  Flujo de Efectivo, Rentabilidad, Antigüedad de Saldos, Consolidación
  y Exportar y Programar de Reportes, Métricas del Negocio, y los 3
  tabs de Análisis Avanzados (Catálogo, Repositorio, Benchmarking).

### Archivos

**Modificado**: `frontend/src/pages/reports/ExecutiveDashboardPage.
jsx` (selector de período real + separación de estados de carga).
**Sin cambios**: el resto de las 15 pantallas de Analítica — auditadas,
sin cambios porque no se encontró un problema real.

### Riesgos / deuda técnica documentada

- Ninguna deuda nueva introducida por esta etapa. La flakiness de
  tests de integración en paralelo contra Postgres real, ya documentada
  en la Etapa 5, sigue siendo preexistente del entorno, no de esta
  etapa (no se re-verificó en esta pieza porque no se tocó backend).

### Estado

**Etapa 6 (Analítica) completa y validada**, con el mismo criterio de
alcance de las etapas anteriores: un solo hallazgo real (Tablero
Ejecutivo duplicando Inicio sin capacidad propia), corregido de forma
proporcionada y verificado de punta a punta. No se avanza a la Etapa 7
(Configuración) sin continuación explícita del usuario — instrucción
reforzada explícitamente en el prompt maestro de Etapas 6/7/8.
