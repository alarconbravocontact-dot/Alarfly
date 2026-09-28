# AI_ARCHITECTURE.md — Arquitectura preparada para IA (F12-B)

> Este documento es el resultado de F12-B — Arquitectura Preparada para
> IA. **No implementa IA.** No integra ningún proveedor, modelo,
> embeddings, vector database, RAG, chatbot ni agente. Define el
> terreno seguro (contratos, límites, modelos de permisos/riesgo/
> aprobación/auditoría) sobre el que una futura capa de IA (F12-C en
> adelante) podrá operar, orquestando capacidades que **ya existen**
> en Alarfly — nunca reemplazándolas.
>
> No existía ningún documento equivalente antes de esta fase (se
> verificó `docs/` y la raíz del proyecto explícitamente antes de
> crear este archivo — solo existe `docs/ARQUITECTURA_MAESTRA.md`, que
> no cubre IA).
>
> **Decisión de alcance explícita, tomada antes de escribir una sola
> línea de código**: esta fase se resolvió **casi en su totalidad como
> documentación**, no como código nuevo. La razón: hoy no existe
> ningún consumidor real de un "AI Context Layer" ni de un catálogo de
> herramientas — nada en el proyecto los llamaría. Escribir ese código
> ahora sería exactamente el "código especulativo" que esta fase
> prohíbe explícitamente y de forma repetida. En su lugar, este
> documento especifica los contratos con precisión suficiente (nombres
> de función reales, inputs/outputs reales) para que, cuando exista un
> primer consumidor real en una fase futura, construirlo sea una tarea
> mecánica y de bajo riesgo — no un rediseño.

---

## 1. Estado de la arquitectura existente (auditoría)

Verificado contra el código real (no contra documentación previa),
reutilizando y extendiendo la auditoría ya hecha en Fase 11 (bis) y su
control independiente, y en F12-A:

| Capacidad transversal | Módulo | Estado |
|---|---|---|
| Contabilización | `core/ledger` (`postEntry`/`reverseEntry`/`submitForApproval`/`approveEntry`/`deleteDraft`) | Única fuente de verdad, confirmado por grep de los 911 archivos del proyecto — cero escrituras de `JournalEntry`/`JournalEntryLine` fuera de acá. |
| Auditoría | `core/audit` (`log`/`listForEntity`/`listForEntities`/`listForCompany`) | Única fuente; toda automatización (F12-A) y todo Ledger la usa. |
| Alertas | `core/alerts` (`createAlertIfNotExists`/`listAlerts`/`listAlertsForUser`/`acknowledgeAlert`/`createRule`) | Único motor, 12 `AlertType`, idempotente por diseño. |
| Jobs/observabilidad | `core/jobs` (`runJob`/`getLastRunsByJob`/`listRuns`) | 9/9 cron jobs instrumentados, tabla `JobRun` consultable. |
| Workflow / maker-checker | `core/workflow` (`assertDifferentActors`) | Única función, usada por Tesorería/Caja Chica/Inventario. |
| RBAC | `core/rbac` (`roles.js`, `module-access.js`, `rbac.middleware.js`, `delegated-permissions.service.js`) | 4 roles fijos (`ADMIN`/`ACCOUNTANT`/`FINANCE`/`COLLABORATOR`), matriz módulo→roles en código, permiso delegado único (`ACCESS_LEVELS`). |
| Bloqueo de periodo | `core/period-lock` (`assertOpenForDate`/`getPeriodForDate`/`closePeriod`/`reopenPeriod`) | Único mecanismo; el Ledger lo consulta antes de postear. |
| Multiempresa / contexto de sesión | `core/account/services/companies.service` (`listMyCompanies`/`switchActiveCompany`), `core/auth` (`buildSession`) | `companyId` viaja en el JWT de sesión; confirmado en Fase 11 (bis) que las 10 tablas de mayor tráfico indexan por `companyId` como primera columna. |
| Lectura financiera consolidada | `modules/finance/services/finance-summary.service.getFinanceSummary(companyId)` | Fuente única ya reutilizada por Dashboard/FP&A/Glossary — no reconstruida en ningún otro punto. |
| Dashboard / catálogo de widgets ya filtrados por rol | `modules/reports/services/dashboard.service.getDashboard(companyId, userId, role, {from,to,asOfDate})` | **Ya es, de hecho, un ejemplo real y funcionando de "tool de lectura con scope de usuario/empresa/rol aplicado en el servidor"** — el precedente más cercano a un Read Tool que ya existe en el proyecto. |
| Analítica / KPIs / Forecast | `modules/fpa`, `modules/reports`, `modules/advanced-analytics`, `modules/business-metrics` | Cada cálculo tiene una sola definición (verificado en Fase 11 bis: EBITDA/Burn Rate/Runway solo en `fpa/services/kpi.rules.js`). |
| Glosario con valor en vivo | `core/glossary/glossary.service.getLiveValue` | Ejemplo real de una pieza que ya resuelve "dame un término + su valor real ahora mismo", el mismo patrón que necesitaría una respuesta de IA con evidencia. |

**Conclusión de la auditoría**: Alarfly **ya tiene** casi todo lo que
una capa de IA necesitaría consumir — servicios de dominio bien
separados, RBAC centralizado, auditoría centralizada, multiempresa
aislado por `companyId`. Lo que **no existe todavía** es una capa que
declare explícitamente, con un contrato uniforme, cuáles de esas
funciones son seguras de exponer como "herramienta" y bajo qué
permisos — eso es lo que este documento especifica.

---

## 2. Source of Truth Map

| Dominio | Fuente única de verdad (servicio real) | Nunca reconstruir vía |
|---|---|---|
| Ventas | `modules/sales/services/sales-orders.service`, `modules/accounts-receivable/services/ar-invoices.service` | Consultas directas a `SalesOrder`/`ArInvoice` fuera de estos servicios para lógica de negocio (lectura simple de campos ya calculados sí es aceptable, replicar la LÓGICA no). |
| Compras | `modules/inventory/services/purchase-orders.service`, `modules/accounts-payable/services/ap-bills.service` | — |
| Inventario | `modules/inventory/services/stock-levels.service`, `valuation.service` | — |
| Dinero / Tesorería | `modules/treasury/services/treasury-accounts.service.getConsolidatedCashPosition` | Confirmado en Fase 11 (bis): 7 puntos de import, todos reutilizan, ninguno reconstruye. |
| Contabilidad | `core/ledger` | Regla de oro del proyecto completo. |
| Fiscal | `modules/fiscal/services/fiscal-transactions.service` | — |
| Clientes | `Customer` (Prisma), gestionado por `modules/accounts-receivable/services/customers.service` | Modelo único, confirmado en Fase 11 (bis). |
| Proveedores | `Vendor` (Prisma), gestionado por `modules/accounts-payable/services/vendors.service` | Modelo único. |
| Productos | `Product`/`ProductVariant`/`ProductCategory`/`ProductUnitConversion`, gestionados por `modules/inventory/services/products.service` | Modelo único. |
| Finanzas consolidadas | `modules/finance/services/finance-summary.service.getFinanceSummary` | — |
| Analítica / KPIs / FP&A | `modules/fpa/services/kpis.service`, `modules/reports/services/*`, `modules/advanced-analytics/services/*` | — |
| Auditoría | `core/audit` | Regla de oro; ninguna automatización (F12-A confirmado) crea un registro paralelo. |
| Alertas | `core/alerts` | Regla de oro; 12 tipos, un solo motor. |

No se encontró ninguna duplicación de fuente de verdad durante esta
auditoría (coincide con lo ya confirmado en Fase 11 bis y su control
independiente). **No se crea ninguna fuente nueva para que la IA
consuma datos** — cualquier herramienta futura de lectura debe
apuntar a una fila de esta tabla, nunca calcular algo por su cuenta.

---

## 3. AI Context Layer — diseño (no implementado)

**Decisión**: se justifica **definir** el contrato, pero no
implementarlo como código todavía (sección "Decisión de alcance" al
inicio de este documento). El contrato propuesto:

```
AIContext = {
  // Identidad — nunca proporcionada por el cliente, siempre derivada
  // del JWT de sesión ya validado por requireAuth (core/auth/auth.middleware)
  userId: string,
  companyId: string,          // empresa activa, la del JWT (ver companies.service)
  role: 'ADMIN' | 'ACCOUNTANT' | 'FINANCE' | 'COLLABORATOR',
  delegatedPermissions: string[],   // ej. ['ACCESS_LEVELS'], desde delegated-permissions.service.listActiveForUser

  // Alcance de módulos — derivado, nunca declarado por la IA
  accessibleModules: string[],      // resultado real de core/rbac/module-access.rolesForModule filtrado por `role`

  // Contexto temporal / regional — de core/account/services/preferences.service
  baseCurrency: string,             // Company.baseCurrency
  displayCurrency: string | null,   // UserPreference.displayCurrency
  timeZone: string,
  dateFormat: string,
  language: string,
  currentPeriod: { id, name, status } | null,  // core/period-lock.getPeriodForDate(companyId, hoy)

  // Metadatos de la consulta misma
  requestId: string,                // para correlación en auditoría/observabilidad
  requestedAt: string,               // ISO timestamp del momento de la consulta

  // Restricciones explícitas (nunca implícitas)
  maxRiskLevel: 0 | 1 | 2 | 3 | 4,   // ver Modelo de Riesgo — nunca mayor a lo que el rol permite
}
```

**Regla de construcción** (para cuando se implemente): este objeto se
arma **en el servidor**, a partir de lo que `req.auth` ya contiene
(`userId`, `companyId`, `role` — ver `core/auth/auth.middleware.js`,
ya construido y usado por las ~264 rutas del proyecto) más consultas
de solo lectura a los servicios ya listados — **nunca a partir de
lo que un cliente (incluida una futura IA) afirme sobre sí mismo**.
Esto ya es, de hecho, exactamente cómo funciona hoy `req.auth` para
cualquier request humano — el `AIContext` no inventa un mecanismo
nuevo, formaliza el mismo que ya existe en un objeto con nombre.

---

## 4. User Context

Ya completamente resuelto por la arquitectura existente — no requiere
ninguna pieza nueva:

- `userId`/`companyId`/`role` → `req.auth`, puesto por `core/auth/auth.middleware.requireAuth` tras validar el JWT (nunca confía en un header del cliente).
- `active company` → `companies.service.switchActiveCompany` reemite el JWT con la empresa elegida; **una futura IA jamás podría cambiar de empresa por su cuenta** sin pasar por este mismo mecanismo autenticado.
- `access level`/`permissions` → `core/rbac/module-access.rolesForModule` + `delegated-permissions.service`.
- `locale`/`currency`/`timezone` → `core/account/services/preferences.service`.
- `current period` → `core/period-lock.getPeriodForDate`.
- `permitted modules` → derivado de `role` contra `MODULE_ROLES` (`core/rbac/module-access.js`).

---

## 5. Read Tools — catálogo (diseño conceptual, sobre servicios reales)

Cada fila = una función que **ya existe**. "Herramienta" no significa
código nuevo: significa que esta función cumple los requisitos para
ser expuesta como tal el día que exista un consumidor.

| Nombre propuesto | Servicio real (source) | Input | Output | Riesgo | Permiso requerido (module-access) |
|---|---|---|---|---|---|
| `getFinancialSummary` | `finance/services/finance-summary.service.getFinanceSummary(companyId)` | `companyId` (del AIContext, nunca del prompt) | Caja, por cobrar/pagar, deuda, comprometido | BAJO | `finance` (los 4 roles) |
| `getCashPosition` | `treasury/services/treasury-accounts.service.getConsolidatedCashPosition` | `companyId` | Saldo consolidado por moneda + colchón de liquidez | BAJO | `treasury` (`ADMIN`/`COLLABORATOR`) |
| `getLiquidityForecast` | `treasury/services/liquidity-forecast.service.getLiquidityForecast` | `companyId`, `weeks` | Saldo proyectado semana a semana (FORECAST, nunca REAL) | BAJO | `treasury` |
| `getReceivablesAging` | `reports/services/aging.service` (modo `receivables`) | `companyId`, `asOfDate` | Baldes de antigüedad de `ArInvoice` | BAJO | `reports` (`ADMIN`/`FINANCE`) |
| `getPayablesAging` | `reports/services/aging.service` (modo `payables`) | `companyId`, `asOfDate` | Baldes de antigüedad de `ApBill` | BAJO | `reports` |
| `getDashboard` | `reports/services/dashboard.service.getDashboard(companyId, userId, role, {from,to,asOfDate})` | contexto completo | Widgets **ya filtrados por rol en el servidor** | BAJO | ninguno adicional — ya se autofiltra por `role` |
| `getKpis` | `fpa/services/kpis.service.getEbitda` / `getBurnRateAndRunway` | `companyId`, rango | EBITDA, Burn Rate, Runway | BAJO | `fpa` (`ADMIN`/`FINANCE`) |
| `getBudgetVariance` | `fpa/services/budget-variance.service` | `companyId`, `budgetId` | Desviación real vs. presupuestado, por línea | BAJO | `fpa` |
| `getAlerts` | `core/alerts/alerts.service.listAlertsForUser(companyId, userId)` | contexto | Alertas activas, ya filtradas por preferencia de notificación del usuario | BAJO | ninguno adicional — transversal por diseño |
| `getPendingApprovals` | `treasury/services/payment-orders.service` (órdenes `PENDING_APPROVAL` del usuario) | `companyId`, `userId` | Lista de aprobaciones pendientes reales | BAJO | `treasury` |
| `getRecentAuditActivity` | `core/audit/audit.service.listForCompany(companyId, {...})` | `companyId`, filtros | Bitácora real, ya paginada | MEDIO (puede exponer quién hizo qué) | `ADMIN`, o el propio usuario vía `activity.service` para su propia actividad |
| `getCustomerBalance` | `accounts-receivable/services/customers.service` + saldo de `ArInvoice` abiertas | `companyId`, `customerId` | Saldo/crédito/bloqueo de un cliente | BAJO | `accounts-receivable` |
| `getSupplierBalance` | `accounts-payable/services/vendors.service` + `ApBill` abiertas | `companyId`, `vendorId` | Saldo de un proveedor | BAJO | `accounts-payable` |
| `getProductStock` | `inventory/services/stock-levels.service` | `companyId`, `variantId` | Stock por almacén, valoración | BAJO | `inventory` |
| `explainGlossaryTerm` | `core/glossary/glossary.service.getLiveValue` | `companyId`, `termKey` | Definición + valor real en vivo | BAJO | transversal (ya lo es hoy) |

**Nunca son Read Tools** (por diseño, no por omisión): ninguna función
que llame `core/ledger.postEntry`/`reverseEntry`, ni nada bajo
`*.service.js` cuyo nombre empiece con `create`/`update`/`delete`/
`approve`/`reject`/`record`/`dispose`/`revalue`. Esa es exactamente la
frontera Read/Action de la sección 8.

---

## 6. Action Tools — catálogo (diseño conceptual, NIVEL 1-2 solamente)

Ninguna de estas se implementa en esta fase. Se documentan para
cuando exista un caso real (F12-C+), y **todas** quedan explícitamente
en Nivel 2 (preparar borrador) — ninguna en Nivel 3+ todavía, porque
ninguna tiene hoy un caso de uso real que lo justifique (ver sección
26, Política de Acción de IA).

| Nombre propuesto | Serviría de envoltura sobre | Riesgo | Requiere aprobación humana |
|---|---|---|---|
| `prepareDraftInvoice` | `accounts-receivable/services/ar-invoices.service.createInvoice`, pero **solo hasta el paso de armar los datos**, nunca llamando al servicio real sin que un humano confirme | ALTO (crea un documento fiscal/contable real si se ejecuta) | Sí, siempre — el propio `createInvoice` ya llama al motor fiscal y postea al Ledger, no hay forma de "deshacer" sin una nota de crédito |
| `preparePaymentOrder` | `treasury/services/payment-orders.service.createPaymentOrder` (la creación en sí es DRAFT/`PENDING_APPROVAL`, ya no ejecuta el pago) | ALTO | Sí — y además el propio maker-checker (`assertDifferentActors`) ya impediría que la misma IA "aprobara" lo que preparó, aunque tuviera el rol |
| `prepareCollectionAction` | Nada nuevo — `ar-collections.service` ya es 100% automático (F12-A/anterior), no necesita que una IA lo dispare | — | No aplica — ya es determinístico |
| `createReminder`/`createTask` | No existe hoy ningún modelo de "tarea" genérica en Alarfly (se verificó: no hay `Task`/`Reminder` en el schema) | BAJO si se implementara | No — pero requeriría **crear** un modelo nuevo, fuera de alcance de F12-B (sería "código especulativo" sin un caso de uso ya aprobado) |
| `markForReview` | Podría envolver `core/audit.log` con una acción tipo `flagged_for_review`, sin mutar ningún dato de negocio | BAJO | No |

**Regla explícita**: ninguna Action Tool, ni siquiera Nivel 2, se
implementa como código en F12-B. La tabla es la especificación para
cuando F12-C decida cuáles construir primero.

---

## 7. Separación Read / Action

Ya garantizada por el propio estilo de código del proyecto (confirmado
en Fase 11 bis): los servicios de "lectura" (`*-summary`, `*-aging`,
`kpis.service.get*`, `dashboard.service.getDashboard`) nunca llaman a
`prisma.*.create/update/delete` ni a `core/ledger`; los servicios de
"escritura" siempre lo hacen dentro de una transacción
(`core/database/unit-of-work.withTransaction`, confirmado en Fase 11
bis con 16 usos reales). Una futura Read Tool que envuelva una función
de lectura hereda automáticamente esta garantía — no hay que
construir nada nuevo para preservarla, solo no envolver nunca una
función de escritura como si fuera de lectura.

---

## 8. Modelo de permisos

**Regla fundamental**: `AI permissions ⊆ USER permissions`, sin
excepción.

Mecanismo (reutilizando lo que ya existe, sin crear nada nuevo):

1. El `AIContext.role`/`accessibleModules` (sección 3) se deriva
   **siempre** del `req.auth` real de la sesión humana que está
   usando la IA — nunca de un rol que la propia IA declare.
2. Cualquier Read/Action Tool futura, antes de ejecutar el servicio
   real que envuelve, pasaría por el **mismo** `core/rbac/rbac.
   middleware.requireModuleAccess`/`requireRole` que ya protege las
   ~264 rutas HTTP del proyecto — no un chequeo de permisos paralelo.
3. Una Action Tool nunca puede completar una operación que el
   `maker-checker` existente (`core/workflow.assertDifferentActors`)
   exigiría que hiciera un actor distinto — incluido el caso "la IA
   preparó la orden de pago, la IA no puede aprobarla", que ya se
   cumple hoy porque `decideApproval` (Tesorería) exige un `userId`
   humano real y compara contra quien la creó.
4. `period-lock` se sigue respetando exactamente igual: cualquier
   Action Tool que termine llamando `core/ledger.postEntry` hereda el
   `assertOpenForDate` que ya corre ahí — no hay forma de que una
   herramienta de IA "salte" el bloqueo de periodo sin reescribir el
   Ledger mismo (fuera de alcance, prohibido explícitamente por la
   regla de oro del proyecto).

---

## 9. Modelo de riesgo

| Nivel | Definición | Ejemplos concretos en Alarfly |
|---|---|---|
| BAJO | Solo lectura, sin mutación | Cualquier fila de la tabla de Read Tools (sección 5) |
| MEDIO | Prepara un borrador; no ejecuta nada financiero | `preparePaymentOrder` hasta el paso `createPaymentOrder` (que ya deja la orden en `DRAFT`, sin mover dinero) |
| ALTO | Ejecuta una escritura financiera/contable/fiscal real | Cualquier llamada real a `ar-invoices.createInvoice`, `ap-payments.recordPayment`, `inventory-movements.createExit`, `fiscal-transactions.createFiscalTransaction` |
| CRÍTICO | Irreversible o afecta el Ledger histórico | `core/ledger.postEntry` de un asiento ya aprobado, cerrar un periodo, `reverseEntry`, cualquier eliminación de datos financieros |

**Regla explícita de esta fase**: ninguna automatización de IA
ejecuta autónomamente Nivel ALTO o CRÍTICO. Eso no cambia en F12-C sin
una política explícita y controles adicionales — F12-B **no** define
esa política todavía, solo dónde tendría que vivir (sección 12).

---

## 10. Approval Gate (diseño conceptual)

```
SOLICITUD DE LA IA
       ↓
AUTORIZACIÓN (AIContext.role, vía core/rbac — ya existe)
       ↓
VALIDACIÓN DE NEGOCIO (el servicio real que se está envolviendo — ya existe)
       ↓
CLASIFICACIÓN DE RIESGO (tabla de la sección 9)
       ↓
¿RIESGO ALTO O CRÍTICO? → SÍ → requiere aprobación humana real,
       │                        vía el workflow que YA existe para
       │                        ese dominio (ej. PaymentOrder →
       │                        payment-orders.service.decideApproval,
       │                        con maker-checker real)
       ↓ NO (BAJO/MEDIO)
EJECUCIÓN (si es una Read Tool) / DEJAR EN BORRADOR (si es Action Nivel 2)
       ↓
AUDITORÍA (core/audit.log, siempre)
```

**No se construye una plataforma de aprobación nueva.** Los 3
workflows de aprobación que ya existen (Órdenes de Pago con niveles
configurables, Caja Chica, Conteos Físicos de Inventario — todos
usando `core/workflow.assertDifferentActors`) ya son exactamente el
Approval Gate que una Action Tool de riesgo ALTO necesitaría — una
futura Action Tool solo tiene que terminar en el mismo punto de
entrada (`submitForApproval`) que ya usa un humano hoy, nunca inventar
un segundo camino de aprobación.

---

## 11. Modelo de auditoría

**Se reutiliza `core/audit` sin ninguna extensión de modelo.** El
esquema actual de `AuditLog` (`companyId`, `userId`, `action`,
`entityType`, `entityId`, `oldValue`, `newValue`, `createdAt`) ya
cubre lo pedido:

| Campo pedido por esta fase | Ya cubierto por `AuditLog` como |
|---|---|
| actor humano | `userId` |
| empresa | `companyId` |
| acción solicitada | `action` (string, ej. `'ar_invoice.created'`) |
| resultado / entidad afectada | `entityType`/`entityId`/`newValue` |
| timestamp | `createdAt` |
| source | ya implícito en el valor de `action` (cada módulo usa su propio prefijo, ej. `payment_order.*`, `advanced_analysis.auto_run`) |

**Lo que no está cubierto hoy y sí haría falta el día que exista un
consumidor real**: "AI actor/context" y "correlation/request id" — no
existen campos para distinguir "esta acción la disparó un humano
directo" de "esta acción la disparó una IA en nombre de un humano", ni
un id de correlación entre una conversación de IA y las filas de
auditoría que generó. **Se documenta como decisión arquitectónica
pendiente, explícitamente NO resuelta en esta fase** (sección "Deuda
técnica") — la opción más simple cuando haga falta sería agregar
`source: String?` (ej. `'human'` | `'ai'`) y `correlationId: String?`
a `AuditLog` vía una migración aditiva, sin tocar los ~50 call-sites
existentes de `audit.service.log` (todos seguirían funcionando con
esos campos en `null`). No se crea esa migración ahora porque no hay
ningún llamador real que necesite poblarla todavía.

---

## 12. Modelo multiempresa

`AI company scope = authenticated active company scope` — ya
garantizado estructuralmente, no por convención:

- El JWT de sesión lleva `companyId` (ver `core/auth.buildSession`).
- Cambiar de empresa activa exige `switchActiveCompany`, que
  re-verifica `UserCompanyAccess` (o, tras el fix de Etapa 7, el
  `companyId` propio del usuario) antes de reemitir el token — nunca
  se puede simplemente "declarar" otra empresa.
- Las 10 tablas de mayor tráfico indexan por `companyId` como primera
  columna (confirmado en Fase 11 bis) — cualquier Read Tool que
  reutilice estos servicios hereda el filtro automáticamente, porque
  el propio servicio ya exige `companyId` como primer parámetro en
  todos los casos de la tabla de la sección 5.

**Caching**: no existe hoy ningún cache de datos financieros en el
backend (confirmado: no hay Redis ni cache en memoria de resultados de
negocio en `src/`, solo `localStorage` del lado del navegador para
preferencias no sensibles, ya documentado en el proyecto). Cuando se
implemente cualquier cache para una futura capa de IA, la clave deberá
incluir siempre `companyId` + `userId` (nunca solo el tipo de consulta)
— documentado como requisito, no implementado porque no hay cache que
proteger todavía.

---

## 13. Minimización de datos

Principio: una Read Tool responde **solo** lo que su nombre promete —
`getProductStock` nunca debería, por ejemplo, incluir el costo unitario
si quien pregunta no tiene acceso a `inventory` con ese detalle. Esto
ya es así porque cada servicio de la tabla de la sección 5 devuelve
una forma de datos específica y acotada — no hay ningún "endpoint
genérico" en Alarfly que devuelva todo un dominio de una vez (se
verificó: ninguna ruta hace `SELECT *` sin filtros de negocio). El
principio de mínimo contexto se hereda gratis de esa disciplina ya
existente; no requiere ninguna pieza nueva.

---

## 14. Trazabilidad

Contrato conceptual para una futura respuesta de IA:

```
Respuesta → Read Tool usada → servicio real (source of truth, sección 2) → companyId/período → timestamp de la consulta
```

Ejemplo concreto con datos reales de este proyecto: *"Tu liquidez
proyectada es 18.928,75 US$"* debería poder trazarse a
`treasury/services/liquidity-forecast.service.getLiquidityForecast`,
empresa activa del `AIContext`, semana calculada desde "hoy", y el
propio `getLiquidityForecast` ya documenta en su respuesta (`note`,
patrón ya usado en el proyecto para el Simulador What-If y la Previsión
de Liquidez) que es un FORECAST, no un hecho histórico — la
distinción REAL/BUDGET/FORECAST/SIMULATION que pide la sección 15 ya
existe como convención en el código (`liquidity.baselineWeeks` vs.
`liquidity.scenarioWeeks` en FP&A, `numericResult` vs. metodología en
Análisis Avanzados) — no hace falta inventar una nueva.

No se implementa una construcción de explicación en lenguaje natural
en esta fase (sería empezar a construir la capa de IA misma) — solo se
deja constancia de qué información ya está disponible en cada
respuesta real para que una futura capa de explicación no tenga que
inventar nada, solo formatear.

---

## 15. Datos sensibles (clasificación conceptual)

| Categoría | Ejemplos en Alarfly | Nota |
|---|---|---|
| Público dentro de empresa | Nombre de la empresa, catálogo de productos activos | — |
| Operativo | Stock, pedidos, movimientos de inventario | — |
| Financiero | Saldos, posición de caja, cuentas por cobrar/pagar | Ya gateado por `finance`/`treasury`/`accounts-receivable`/`accounts-payable` en RBAC |
| Contable | Asientos, Libro Mayor | Gateado por `accounting` |
| Fiscal | Tasas, retenciones, documentos electrónicos | Gateado por `fiscal` |
| Administrativo | Usuarios, roles, cupos | Gateado por Niveles de Acceso (`ADMIN`/delegado) |
| Altamente sensible | Contraseñas (hash), secretos 2FA (cifrados), tokens de sesión | **Nunca** deberían ser alcanzables por ninguna Read Tool — ninguna de la tabla de la sección 5 las toca, y así debe permanecer explícitamente |

No se inventa ninguna política legal específica (ej. LOPD/GDPR/Habeas
Data) — se documenta como decisión pendiente si el usuario opera en
una jurisdicción con requisitos particulares, para resolver antes de
conectar cualquier proveedor externo de IA (sección 22).

---

## 16. Contratos de herramienta (forma propuesta, sin implementar)

Si se implementan en el futuro, cada herramienta se validaría con
**Zod** (ya es la librería de validación de todo el proyecto — no se
introduce una segunda tecnología, cumpliendo la sección 19 al pie de
la letra):

```js
const ToolContract = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.instanceof(z.ZodType),
  outputSchema: z.instanceof(z.ZodType),
  permissions: z.array(z.enum(['ADMIN', 'ACCOUNTANT', 'FINANCE', 'COLLABORATOR'])),
  companyScoped: z.literal(true), // siempre true, sin excepción
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  mutatesData: z.boolean(),
  requiresApproval: z.boolean(),
  auditRequired: z.literal(true), // siempre true, sin excepción
  idempotent: z.boolean(),
});
```

---

## 17. Manejo de errores (diseño conceptual)

Categorías propuestas, mapeadas a lo que **ya existe** en
`core/utils/AppError` (la clase de error única del proyecto, con
`message`/`statusCode`/`code`, ya usada por las ~264 rutas):

| Categoría para IA | Ya existe como |
|---|---|
| validation error | `AppError` con código `*_REQUIRED`/`*_INVALID` (Zod) |
| authorization error | `403` (`core/rbac/rbac.middleware`) |
| not found | `404` (`*_NOT_FOUND`, patrón en todos los servicios) |
| business rule violation | `AppError` de negocio (ej. `CREDIT_LIMIT_EXCEEDED`, `CUSTOMER_BLOCKED`) |
| approval required | Estado `PENDING_APPROVAL` de la entidad, nunca un error — se modela como estado, no como excepción |
| period locked | `AppError` de `core/period-lock` |
| company scope violation | `404` (nunca `403`, para no confirmar que el registro existe en otra empresa — patrón ya usado en Niveles de Acceso) |
| transient infrastructure error | Error no controlado → `core/middlewares/errorHandler` ya lo traduce a un mensaje genérico, nunca expone el stack al cliente |

Una futura capa de IA solo necesitaría mapear estas categorías (ya
diferenciadas por `AppError.code`/`statusCode`) a una respuesta
conversacional — no hace falta ningún cambio de backend para esto.

---

## 18. Regla absoluta: sin acceso directo a base de datos

Confirmado por diseño, no por promesa: **ninguna Read/Action Tool
propuesta en este documento invoca `prisma` directamente** — todas
envuelven un `*.service.js` ya existente. Esto no es una regla nueva
que haya que hacer cumplir con código adicional: es simplemente que,
si en el futuro se construyen estas herramientas envolviendo los
servicios de la sección 5/6 (y no el cliente Prisma), la regla se
cumple por construcción.

---

## 19. Proveedor de IA externo — qué aislar cuando exista (no implementado)

Cuando F12-C conecte un proveedor real, deberá aislarse (documentado
ahora, sin código):

- `provider` (Anthropic/OpenAI/otro) detrás de una interfaz, nunca
  llamado directo desde un controlador de Alarfly.
- `apiKey` — variable de entorno, nunca en código ni en `AuditLog`.
- `model`, `timeout`, `retries`, `tokenLimits`, `costLimits` —
  configuración explícita, no implícita.
- Política de privacidad del proveedor (qué datos de Alarfly saldrían
  hacia un tercero) — **decisión pendiente explícita**, debe
  resolverse antes de conectar cualquier proveedor real, no en esta
  fase.
- `logging` de lo que se envía al proveedor — para poder auditar qué
  datos de la empresa salieron, cuándo.
- `fallback`/`rateLimits` — comportamiento cuando el proveedor falla o
  se satura, nunca debe degradar en un error crudo hacia el usuario.

---

## 20. Abstracción `AIProvider` — evaluación (no implementada)

Se evaluó la interfaz conceptual `AIProvider.generate()/stream()/
toolCall()`. **Decisión: no crear la interfaz todavía.** Razón
explícita: no existe ninguna implementación real (ni siquiera un
proveedor elegido) — una interfaz sin ninguna implementación real
detrás es exactamente el tipo de "abstracción vacía por anticipación"
que esta fase prohíbe. Cuando F12-C elija un primer proveedor, la
interfaz se extrae en ese momento a partir de la implementación real
(refactor con caso de uso concreto), no al revés.

---

## 21. Observabilidad (qué hará falta, no implementado)

Cuando exista un primer consumidor: `requestId`, `userId`, `companyId`,
qué herramienta se llamó, tiempo de ejecución, errores, resultado de
la acción, estado de aprobación — **todo esto ya tiene un lugar
natural**: `core/audit` (para la traza de negocio) + los logs
estructurados que ya usa el proyecto (`morgan`, ya configurado en
`app.js`) para lo operacional. Métricas específicas de LLM (uso de
tokens, costo, modelo/proveedor) se documentan como necesarias
**después** de F12-C, no antes — no hay nada que medir todavía.

---

## 22. Seguridad — riesgos futuros documentados (no mitigados con código todavía)

| Riesgo | Control que deberá existir antes de conectar un modelo real |
|---|---|
| Prompt injection | Nunca ejecutar una Action Tool solo porque el texto de una respuesta del modelo lo "pida" sin pasar por el Approval Gate real (sección 10) |
| Data leakage | Minimización de datos (sección 13) + nunca registrar el contenido completo de un prompt/respuesta en `AuditLog` sin revisar antes qué contiene |
| Cross-company leakage | `AIContext.companyId` siempre derivado del servidor (sección 3) — nunca de un parámetro que la IA o el usuario puedan manipular en el prompt |
| Escalada de privilegios | Regla `AI permissions ⊆ USER permissions` (sección 8), sin excepción, verificable porque toda Action Tool pasaría por el mismo `core/rbac` que ya protege las rutas HTTP |
| Abuso de herramientas | Rate limiting / límite de llamadas por sesión — no implementado, documentado como pendiente |
| Acciones no autorizadas | Approval Gate (sección 10) para todo lo que no sea Nivel 0-1 |
| Instrucciones maliciosas incrustadas en datos de la empresa (indirect prompt injection) | Cualquier dato que una Read Tool devuelva (ej. la descripción de un producto, el nombre de un cliente) es **dato**, nunca instrucción — mismo principio que ya aplica en este proyecto a cualquier contenido externo (ver reglas de manejo de contenido no confiable del propio entorno de ejecución) |
| Exposición de información sensible | Clasificación de la sección 15, aplicada antes de que cualquier dato llegue a un proveedor externo |

No se implementa ninguna de estas defensas todavía — se documentan
como checklist obligatorio de la fase que sí conecte un proveedor
real.

---

## 23. Política de Acción de IA (niveles de autonomía)

| Nivel | Definición | Estado en F12-B |
|---|---|---|
| 0 — Solo lectura | Consultar (sección 5) | Arquitectura documentada, lista conceptualmente |
| 1 — Recomendar | Sugerir una acción con evidencia, sin ejecutarla | Ya existe de facto vía `core/alerts`/insights (F12-A) — una futura IA orquestaría estos, no los duplicaría |
| 2 — Preparar borrador | Armar los datos de una acción sin ejecutarla | Diseñado conceptualmente (sección 6), no implementado |
| 3 — Ejecutar acción segura | Determinística, reversible, sin impacto financiero | **No se implementa en esta fase** — no se encontró ningún caso real que calificara con evidencia suficiente |
| 4 — Ejecutar con aprobación humana | Workflows/aprobación ya existentes | Diseñado (sección 10), reutiliza el maker-checker real — no implementado |
| 5 — Autónoma de alto impacto | — | **Explícitamente NO se implementa**, ni se diseña más allá de esta prohibición |

---

## 24. Futuros asistentes (catálogo documental, sin interfaces)

| Asistente | Preguntas típicas | Read Tools que usaría | Riesgo típico | Acciones posibles (Nivel máx.) |
|---|---|---|---|---|
| Financiero | "¿Cuánto tengo disponible?", "¿Cuánto debo?" | `getFinancialSummary`, `getCashPosition`, `getLiquidityForecast` | BAJO | Nivel 1 (recomendar) |
| Operativo | "¿Qué pedidos están pendientes?" | `getDashboard`, capacidades de Ventas/Compras (no cubiertas aún en la tabla de la sección 5, quedarían para cuando se necesiten) | BAJO | Nivel 1-2 |
| Inventario | "¿Qué productos tienen stock bajo?" | `getProductStock`, `core/alerts` (`LOW_STOCK` ya existe) | BAJO | Nivel 1 |
| Cobranza | "¿Qué clientes están atrasados?" | `getReceivablesAging`, `getCustomerBalance`, `core/alerts` (`AR_COLLECTION_ESCALATION` ya existe) | MEDIO (puede sugerir bloquear a un cliente) | Nivel 2 (preparar, nunca bloquear solo) |
| Compras | "¿Qué facturas de proveedor vencen esta semana?" | `getPayablesAging`, `getSupplierBalance`, la nueva alerta `PAYMENT_DUE_SOON`/`ApBill` de F12-A | BAJO | Nivel 1 |
| Dirección | "¿Cómo va el negocio este mes?" | `getDashboard`, `getKpis`, `getBudgetVariance` | BAJO | Nivel 1 |
| Contable/Fiscal | "¿Este asiento cuadra?", "¿Qué obligaciones fiscales vencen?" | Reportes de Contabilidad, `FISCAL_OBLIGATION_DUE` (ya existe) | ALTO si se le permitiera proponer asientos — no se le permite en esta fase | Nivel 1 solamente |

No se implementa ninguna interfaz para estos asistentes — es
exclusivamente el inventario que pide la sección 27 del prompt.

---

## 25. No duplicar inteligencia existente

Antes de que cualquier futura capacidad de IA "calcule" algo, debe
verificar si ya existe (checklist para F12-C, no una implementación):
KPI (`fpa/services/kpi.rules.js`), reporte (`modules/reports`),
forecast (`liquidity-forecast.service`), Advanced Analytics (16 tipos
ya cubiertos), alerta (`core/alerts`, 12 tipos), insight
(`reports/services/insights.service`). La IA **interpreta y orquesta**
estas capacidades — nunca las reimplementa con un prompt. Esto ya es
coherente con cómo se construyó todo el proyecto hasta ahora (cero
duplicaciones de KPI encontradas en Fase 11 bis).

---

## Capacidades reutilizadas (resumen)

`core/ledger`, `core/audit`, `core/alerts`, `core/jobs`, `core/workflow`,
`core/rbac`, `core/period-lock`, `core/auth`, `core/account` (contexto de
usuario/empresa), `core/glossary`, `finance-summary.service`,
`dashboard.service`, y los servicios de dominio de los 8 módulos de
negocio — **el 100% de lo que este documento cataloga ya existe y ya
está probado** (672 tests de backend a la fecha de esta fase).

## Código nuevo de esta fase

**Ninguno.** Decisión explícita y documentada al inicio de este
archivo: construir el "AI Context Layer" o cualquier Read/Action Tool
como código ejecutable ahora, sin ningún consumidor real, sería
"código especulativo" — prohibido explícitamente y de forma repetida
en el pedido de esta fase.

## Documentación nueva

Este archivo, `AI_ARCHITECTURE.md`.

## Tests

No aplica — no se escribió código nuevo. Se corrió la regresión
completa (ver Validación) para confirmar que documentar esta
arquitectura no tocó ni un archivo de `src/`/`frontend/src/`.

## Deuda técnica / decisiones pendientes (explícitas, no resueltas aquí)

1. `AuditLog` no distingue actor humano de actor-IA ni tiene
   `correlationId` — documentado en la sección 11, no implementado
   (migración aditiva simple cuando exista el primer consumidor real).
2. Política de privacidad/jurisdicción para datos que saldrían hacia
   un proveedor externo — sección 15/19, decisión de negocio
   pendiente, no técnica.
3. Ningún Nivel 3+ de autonomía tiene un caso real evaluado todavía —
   sección 23.
4. Los Action Tools de la sección 6 son puramente conceptuales; el
   primero que se implemente (probablemente `preparePaymentOrder`,
   por ser el que más se apoya en mecanismos ya existentes) debería
   ser el piloto de F12-C, no varios a la vez.

## Qué queda para F12-C

Elegir **un** primer caso real (probablemente una sola Read Tool, ej.
`getFinancialSummary`, sobre una interfaz de consulta simple) y
construirlo end-to-end contra este documento — recién ahí se sabrá si
el contrato de la sección 16 necesita ajustes antes de generalizarlo.
F12-C también deberá decidir el proveedor de IA (sección 19-20) y
resolver las decisiones pendientes de la sección de deuda técnica que
ese primer caso real toque.
