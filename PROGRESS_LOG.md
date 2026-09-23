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
