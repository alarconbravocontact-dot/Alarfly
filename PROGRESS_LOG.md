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
