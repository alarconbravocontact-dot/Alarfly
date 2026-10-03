# Auditoría Arquitectónica y Funcional Global Post-Afiliados

Alcance: verificar que todo el sistema (no solo el módulo de Afiliados)
sigue siendo coherente después de introducir la primera pieza que opera
fuera del límite tradicional de `Company`. No se crea funcionalidad
nueva, no se rediseña nada — solo se audita, se clasifica cada hallazgo,
y se corrige lo que sea seguro corregir ahora.

## 1. Estado general

**CERRADO.** Se encontraron y corrigieron 2 hallazgos **CRÍTICOS** (uno de
seguridad transversal a todo el proyecto, uno que rompía el registro
público normal) y 3 **IMPORTANTES** (concurrencia y atomicidad de
auditoría en la administración de comisiones/afiliados, manejo de
errores en el frontend de administración). Todos corregidos, probados y
re-verificados de punta a punta antes de cerrar esta auditoría — no
queda ningún problema crítico conocido.

## 2. Arquitectura actual

El proyecto tiene ahora **tres capas de autenticación/contexto**, donde
antes solo existía una:

| Capa | Actor | Token | Contexto | Dónde vive |
|---|---|---|---|---|
| Empresa | `User` | sesión normal (`userId`+`companyId`+`role`+`sessionId`) | Siempre dentro de UNA `Company` | `core/auth` |
| Plataforma (afiliado) | `Affiliate` | token propio (`affiliateId`, `type: 'affiliate'`) | Nunca pertenece a ninguna `Company` | `core/affiliates` |
| Plataforma (administración) | `User` + flag | la MISMA sesión de empresa + `isAffiliateProgramAdmin` | Cruza todas las `Company` | `core/affiliates` (puerta), reutiliza `core/auth` (sesión) |

Esto es, por diseño, el primer punto del proyecto donde "estar
autenticado" ya no implica automáticamente "pertenecer a una empresa" —
la auditoría se enfocó precisamente en verificar que esa nueva
posibilidad no se filtrara, por accidente, hacia rutas que siguen
asumiendo lo contrario.

## 3. Separación Company / Global / Affiliate

| Entidad | Alcance | Nota |
|---|---|---|
| `User`, `Customer`, `ArInvoice`, `JournalEntry`, … (los ~95 modelos de negocio) | **Company** | Sin cambios — todos siguen exigiendo `companyId` obligatorio |
| `Affiliate`, `AffiliateReferral`, `AffiliateCommission` | **Global/plataforma** | Nunca referencian `companyId` directamente (solo `AffiliateReferral.referredCompanyId`, que es una referencia A una empresa, no una pertenencia DE una empresa) |
| `AffiliateProgramSettings` | **Global** | Fila única, sin `companyId`, por diseño |
| `User.isAffiliateProgramAdmin` | Atributo de **User** (Company), pero su efecto es **cross-company** | Documentado como excepción explícita, no un patrón a repetir sin razón |
| `AuditLog` | **Company u opcional (global)** | Ver sección 8 |

No se encontró ninguna entidad mal clasificada. El único campo que
cambió de alcance fue `AuditLog.companyId` (de obligatorio a opcional),
tratado en detalle en la sección 8.

## 4. Seguridad

### 4.1 Hallazgo CRÍTICO — corregido: `requireAuth` aceptaba cualquier JWT válido, sin validar su forma

**Antes de esta auditoría**, `core/auth/auth.middleware.requireAuth`
verificaba únicamente la firma del JWT (`jwt.verify`), nunca la FORMA
del payload. El proyecto ya firmaba, con el mismo `JWT_SECRET`, un
segundo tipo de token (`PENDING_2FA`, 5 minutos, solo para el segundo
paso del login) sin `companyId`/`role`. Fase Afiliados agregó un
**tercer** tipo (`type: 'affiliate'`, 30 días, **obtenible gratis por
cualquiera con solo registrarse** en `/affiliates/register`) — a
diferencia del `PENDING_2FA` (de corta vida y solo alcanzable a mitad de
un login real), el token de afiliado es trivial y barato de conseguir
por cualquier persona en internet.

**Confirmado en vivo, antes del fix**: un token de afiliado recién
registrado, reenviado como `Authorization: Bearer` contra
`GET /notifications` (una ruta protegida solo con `requireAuth`, sin un
segundo gate de rol/módulo), devolvió alertas reales de **varias
empresas distintas mezcladas en la misma respuesta** — porque
`req.auth.companyId` quedaba `undefined`, y en Prisma, un valor
`undefined` dentro de un `where` **elimina ese filtro por completo**
(comportamiento documentado de Prisma, no un bug de Prisma) en vez de no
encontrar nada.

**Corrección**: `requireAuth` ahora rechaza cualquier payload que traiga
`type` (ninguna sesión de empresa real lo tiene) o que no traiga
`userId`+`companyId` — en la única puerta de entrada real, no ruta por
ruta. Verificado de nuevo en vivo: el mismo token de afiliado contra
`/notifications` y `/account/company-profile` ahora devuelve 401
`INVALID_TOKEN`; una sesión real de empresa sigue funcionando sin
cambios. 4 tests unitarios nuevos (`auth.middleware.test.js`) cubren
explícitamente el token de afiliado, el `PENDING_2FA`, y cualquier
payload sin `companyId`/`userId` aunque no tenga `type`.

**Clasificación**: CRÍTICO. **Estado**: corregido y verificado.

### 4.2 Autenticación

- **JWT**: un solo secreto para los 3 tipos de token, ahora
  correctamente segmentados por forma (sección 4.1).
- **Expiración**: sesión de empresa 8h (configurable), `PENDING_2FA` 5
  min, afiliado 30 días. La asimetría es intencional y está documentada
  (`AFFILIATE_SYSTEM_FINAL.md`, sección 15) — un afiliado nunca mueve
  dinero ni aprueba nada desde su propia sesión, solo lee su propio
  tablero.
- **Refresh**: no existe para ningún tipo de token (tampoco existía
  antes de esta fase) — fuera de alcance de esta auditoría.
- **Separación usuario/afiliado**: confirmada en ambas direcciones.
  `requireAuth` ahora rechaza un token de afiliado (sección 4.1);
  `requireAffiliateAuth` ya rechazaba correctamente un token de empresa
  desde el principio (exige `type === 'affiliate'`).
- **Recuperación de contraseña / registro / login**: sin cambios de
  comportamiento para `User`; `Affiliate` tiene su propio
  registro/login (bcrypt + JWT, mismo patrón), sin recuperación de
  contraseña — mismo límite que ya tiene todo el proyecto (no hay envío
  de correo real en ningún punto), no una omisión nueva de esta pieza.

### 4.3 Autorización

- **Un afiliado no puede acceder a otra cuenta**: confirmado — cada
  endpoint de `/affiliates/me/*` deriva el id SIEMPRE de
  `req.affiliateAuth.affiliateId` (del token), nunca de un parámetro de
  la URL.
- **Un usuario normal no puede acceder al panel administrativo de
  afiliados**: confirmado en vivo con un usuario Colaborador real — no
  ve el enlace en el menú y recibe 403 real al intentar la API
  directamente (`GET /affiliate-admin/affiliates` → 403
  `FORBIDDEN`).
- **`isAffiliateProgramAdmin` protegido correctamente**: se lee fresco
  de la base en cada petición (nunca cacheado en el JWT), mismo
  criterio que `requireAccessManagement` ya usa para el permiso
  delegado de Niveles de Acceso — revocarlo a mano surte efecto de
  inmediato, sin esperar a que expire una sesión.
- **No basta con manipular el frontend**: confirmado — el ítem de menú
  se oculta en el cliente, pero el backend es quien de verdad bloquea
  (403 real, no un error de UI).
- **IDs no permiten acceder a recursos ajenos**: los endpoints de
  administración (`GET /affiliate-admin/affiliates/:id`, etc.) SÍ dejan
  pasar cualquier id — es correcto por diseño, esa es la función de la
  administración cruzada (ver un afiliado cualquiera), protegida por el
  flag de plataforma, no por ownership.

### 4.4 Multiempresa

- Confirmado que ninguna empresa puede leer datos de otra a través de
  ningún endpoint de negocio existente (sin cambios respecto a antes de
  esta fase).
- Las rutas cross-company (`/affiliate-admin/*`) están explícitamente
  marcadas y protegidas por su propio gate, nunca mezcladas con las
  rutas por-empresa.
- No se encontraron fugas de información nuevas más allá del hallazgo
  4.1, ya corregido.

## 5. Datos (modelos, relaciones, constraints, índices)

Revisión completa de `Affiliate`/`AffiliateReferral`/
`AffiliateCommission`/`AffiliateProgramSettings`:

- **Constraints de unicidad**: `Affiliate.email`, `Affiliate.code`,
  `AffiliateReferral.referredCompanyId` (la protección central
  anti-duplicación), `AffiliateCommission[referralId, eventType]`
  (anti-duplicación de comisión) — las 4 confirmadas con tests que
  intentan violarlas directamente contra Prisma.
- **Cascadas**: `AffiliateReferral`/`AffiliateCommission` se borran en
  cascada si se borra el `Affiliate` dueño (correcto, sin huérfanos);
  `AffiliateReferral` se borra en cascada si se borra la `Company`
  referida (correcto); `Affiliate.linkedUserId` usa `SetNull` si se
  borra el `User` vinculado (correcto — el afiliado y su historial de
  comisiones sobreviven, solo se pierde el vínculo informativo).
- **Precisión monetaria**: `baseAmount`/`rateValue`/`amount` son
  `Decimal` con precisión fija (14,2 / 14,4), nunca `Float` — confirmado
  que `computeCommissionAmount` usa `Prisma.Decimal` en toda la
  aritmética, nunca JavaScript `Number` para el cálculo final.
- **Snapshot**: `AffiliateCommission` graba su propio
  `rateType`/`rateValue`/`baseAmount`/`currency` en el momento de
  generarse — un cambio posterior en `AffiliateProgramSettings` nunca
  altera una comisión ya existente (confirmado leyendo el código, es
  estructural: no hay ninguna función que vuelva a leer `Settings` para
  una comisión ya creada).
- **Índices**: `Affiliate.status`, `AffiliateReferral.affiliateId`,
  `AffiliateCommission[affiliateId, status]` presentes. **MEJORA
  FUTURA** (no corregida, no bloqueante): `listAllCommissions({status})`
  sin `affiliateId` (el filtro por estado solo, usado por la
  administración) no tiene un índice dedicado solo en `status` — el
  índice compuesto existente no lo cubre de forma óptima. Con el volumen
  actual (una pieza recién nacida, sin tráfico real) esto es
  irrelevante en la práctica; se documenta para revisar si el volumen
  de comisiones crece.
- **`AuditLog.companyId` opcional**: ver sección 8.

No se modificó ningún modelo que ya estuviera correcto — la única
corrección de datos de esta auditoría fue de código (secciones 4.1,
7.1, 7.2), no de schema.

## 6. Finanzas

Confirmado explícitamente, leyendo cada línea de `core/affiliates/`:

- **Las comisiones NUNCA tocan el Ledger**: `grep` de
  `ledger|JournalEntry|postEntry|arInvoice|apBill|TreasuryAccount` en
  todo `src/core/affiliates/` → **0 resultados**. Ninguna comisión
  genera un asiento contable, ninguna toca CxC/CxP, ninguna mueve el
  saldo de ninguna cuenta de Tesorería.
- **Nunca se presenta como "pagada" antes de estarlo**: el estado
  `PAID` es una anotación administrativa manual (`paidAt` + acción
  explícita de un Administrador de Plataforma) — el sistema no tiene
  pasarela de pago integrada, a propósito (instrucción explícita de la
  Fase Afiliados), así que `PAID` documenta un hecho que ocurrió FUERA
  del sistema, nunca lo ejecuta.
- **Definiciones de estado** (ya documentadas en
  `AFFILIATE_SYSTEM_FINAL.md`, sección 10, reconfirmadas acá):
  - `PENDING`: se generó automáticamente al atribuirse un referido, sin
    revisar.
  - `APPROVED`: un Administrador de Plataforma confirmó que el referido
    es legítimo.
  - `PAYABLE`: lista para pagarse (ej. pasada alguna ventana de espera
    que el Administrador decida usar — el sistema no impone ninguna).
  - `PAID`: el pago ya se hizo, fuera del sistema; el estado es un
    registro, no una acción.
  - `CANCELLED`: anulada, con motivo opcional en `statusNote`.
- **Moneda**: cada comisión guarda su propia `currency` (snapshot de
  `AffiliateProgramSettings.currency` al momento de generarse) — nunca
  asume un valor fijo ni la convierte.
- **No se inventó contabilidad de comisiones**: confirmado que no existe
  ningún plan de cuentas, cuenta de gasto, ni asiento relacionado a
  afiliados en todo el schema — correcto, el producto no lo pidió y no
  se improvisó.

**Clasificación de esta sección completa: SIN PROBLEMA.**

## 7. API

### 7.1 Hallazgo CRÍTICO — corregido: registro público roto para CUALQUIER empresa sin código de referido

Encontrado con Playwright probando el flujo normal de una empresa (sin
tocar nada de afiliados): `POST /auth/signup` devolvía 400
`"Dato inválido en \"referralCode\": Expected string, received null"`.
Causa: `signupSchema.referralCode` usaba `.optional()` (Zod: acepta que
la llave esté AUSENTE) pero el frontend (`AuthContext.signup`) **siempre
manda la llave**, con el código real o con `null` cuando
`getStoredReferralCode()` no encontró ninguno — el caso normal, la
inmensa mayoría de todos los registros futuros. `.optional()` nunca
acepta `null` explícito.

Esto significaba que, desde que se desplegó Fase Afiliados, **todo
registro público sin un enlace de afiliado de por medio estaba roto** —
el embudo de crecimiento principal del producto (Fase Landing) quedó
inutilizable para cualquier visitante que no llegara desde un enlace de
afiliado.

**Corrección**: `referralCode: z.string().max(40).nullable().optional()`.
Verificado con `curl` y Playwright: un registro sin código (enviando
`null`) ahora devuelve 201 y aterriza en el Panel principal
correctamente. 3 tests nuevos (`auth.validator.test.js`) fijan este
contrato exacto (acepta `null`, acepta ausente, acepta un código real).

**Clasificación**: CRÍTICO. **Estado**: corregido y verificado.

### 7.2 Hallazgo IMPORTANTE — corregido: condición de carrera en transiciones de estado

`transitionCommissionStatus`/`setAffiliateStatus` leían el estado
actual, validaban la transición, y RECIÉN DESPUÉS escribían — dos
peticiones concurrentes sobre la misma comisión/afiliado podían leer el
mismo estado, pasar las dos la validación, y escribir las dos sin
enterarse una de la otra (la segunda pisa silenciosamente el resultado
de la primera). Baja probabilidad hoy (normalmente un solo
Administrador de Plataforma), pero es dinero real y la corrección es
barata y segura.

**Corrección**: el `update` se volvió condicional en el estado leído
(`updateMany` con el estado viejo en el `where`, atómico a nivel de
base de datos) — si otra petición ya cambió el estado entre medio, no
actualiza ninguna fila y se rechaza con 409 `*_STATE_CHANGED` en vez de
corromper el historial. Test nuevo de integración dispara dos
transiciones concurrentes reales (`Promise.allSettled`) contra la misma
comisión y confirma que exactamente una tiene éxito.

**Clasificación**: IMPORTANTE. **Estado**: corregido y verificado.

### 7.3 Hallazgo IMPORTANTE — corregido: cambio de estado y su auditoría no eran atómicos

En la misma función de 7.2: el cambio de estado (`updateMany`) y su
entrada de `AuditLog` se escribían como dos operaciones Prisma
separadas, sin transacción — si el proceso caía justo entre medio
(crash, caída de conexión), la comisión quedaba cambiada **sin ningún
rastro de auditoría**, contradiciendo la promesa explícita de
trazabilidad completa de esta pieza. El resto del proyecto nunca hace
esto (`auth.service.signup` ya pasa `tx` a `auditService.log` dentro de
su propio `$transaction`).

**Corrección**: ambas funciones ahora envuelven el `updateMany`
condicional + `auditService.log(..., tx)` + lectura final en un único
`prisma.$transaction`. Reconfirmado con los 21 tests de integración del
módulo, todos verdes.

**Clasificación**: IMPORTANTE. **Estado**: corregido y verificado.

### 7.4 Hallazgo IMPORTANTE — corregido: la administración de afiliados no mostraba errores de acción

`AffiliateAdminPage.jsx` (`handleTransition`/`handleToggleAffiliateStatus`)
no atrapaba errores de la API — un fallo (ej. el 409 nuevo de 7.2, o
cualquier otro) fallaba en silencio, sin avisar nada en pantalla, a
diferencia del patrón ya establecido en el resto del proyecto (ej.
`CustomersPage.handleToggleActive`, que sí envuelve en `try/catch` y
muestra el mensaje real). Corregido con el mismo patrón: estado
`actionError`, mostrado con la misma clase `.login-error` que ya usa el
resto de la app para errores en línea.

**Clasificación**: IMPORTANTE. **Estado**: corregido y verificado (build/lint limpios).

### 7.5 Resto de la superficie de API

- **Validación**: Zod en los 3 endpoints con body nuevo
  (`/affiliates/register`, `/affiliate-admin/commissions/:id/status`,
  `/affiliate-admin/settings`) — ninguno confía en datos sin validar.
- **Montos nunca confiados del cliente**: ningún endpoint acepta un
  monto de comisión — siempre se calcula server-side a partir de
  `AffiliateProgramSettings` (ver sección 6).
- **Status codes**: 201 en creación (`register`), 200 en lecturas/
  actualizaciones, 401/403 en auth/autorización, 404 en no encontrado,
  409 en conflicto de estado (nuevo, 7.2) — consistentes con el resto
  del proyecto.
- **Rate limiting**: no existe infraestructura para esto en todo el
  proyecto (ni antes ni después de esta fase) — fuera de alcance,
  mismo límite ya conocido.

## 8. Auditoría (CORE/AUDIT)

- **`AuditLog.companyId` opcional no debilitó la auditoría existente**:
  confirmado — las ~100 llamadas existentes a `audit.service.log()`
  siguen pasando un `companyId` real (no se tocó ninguna), y
  `listForCompany`/`listForEntity` (usadas por el audit trail de cada
  empresa y por Mi Cuenta > Actividad) siguen exigiendo un `companyId`
  real como parámetro obligatorio — un filtro `where: {companyId: 'x'}`
  nunca puede devolver una fila con `companyId: null`, así que ninguna
  fila de auditoría de plataforma puede colarse en la vista de una
  empresa.
- **Eventos nuevos, correctamente diferenciados**: `affiliate.registered`,
  `company.referred_by_affiliate` (con el `companyId` REAL de la
  empresa referida — visible en SU propia bitácora), `affiliate.referral_attributed`
  (companyId: null, bitácora cruzada), `affiliate_commission.status_changed`,
  `affiliate.status_changed`.
- **Se agregó UNA función nueva a `audit.service.js`**
  (`listForEntityTypesAnyCompany`), no un sistema paralelo — es la
  única lectura que necesita cruzar empresas, reservada exclusivamente
  a la administración de plataforma.
- **Huecos de auditoría del resto del sistema**: no se encontró ningún
  movimiento sensible pre-existente sin auditoría durante esta
  revisión — no se buscó exhaustivamente fuera del área tocada por esta
  fase (eso ya fue cubierto por las auditorías de fases anteriores,
  documentadas en `PROGRESS_LOG.md`), consistente con la instrucción de
  no inventar un rediseño de auditoría general.

**Clasificación: SIN PROBLEMA** (más allá de 7.3, ya corregida).

## 9. UX / Navegación

- **Sidebar**: 2 ítems nuevos y condicionales ("Programa de Afiliados"
  siempre visible, "Administración de Afiliados" solo si
  `isAffiliateProgramAdmin`) — sin duplicados, confirmado que
  `canAccessModule` no gatea el primero (cualquier rol puede ser
  afiliado) y que el segundo se pregunta con la misma llamada liviana
  (`am-i-admin`) que ya usa el patrón de "Niveles de Acceso".
- **Responsive**: 390px/768px revisados; un diferencial de 2px en
  `scrollWidth` del tablero del afiliado a 390px no se pudo atribuir a
  ningún elemento real (barrido con tolerancia de 2px sin resultados) —
  documentado como posible artefacto de sub-píxel del navegador
  headless, **MEJORA FUTURA**, no un defecto visible confirmado.
- **Estados vacíos/carga/confirmaciones**: `EmptyState`, `useConfirm`,
  estados de carga explícitos presentes en ambas pantallas nuevas desde
  el principio.
- **Errores**: corregido en 7.4 (el único hueco real encontrado).
- **Coherencia visual**: ambas pantallas reutilizan `.page`/
  `.page-header`/`.data-table`/`StatusSeal`/`EmptyState`/`Breadcrumb` —
  confirmado visualmente con Playwright que no se sienten como un
  producto aparte.

**Clasificación: SIN PROBLEMA** (más allá de 7.4, ya corregida).

## 10. Tests

- **4 tests nuevos** en `auth.middleware.test.js` (hallazgo 4.1).
- **3 tests nuevos** en `auth.validator.test.js` (hallazgo 7.1).
- **1 test nuevo** de concurrencia en `affiliates.integration.test.js`
  (hallazgo 7.2).
- **Total del proyecto: 746/746 tests pasando**, 0 regresiones (738 al
  cerrar Fase Afiliados + 8 nuevos de esta auditoría = 746).
- **Lint backend**: 0 errores. **Lint frontend**: mismo baseline (9
  warnings `only-export-components`, patrón arquitectónico ya conocido,
  0 nuevos). **Build frontend**: limpio, 889 módulos.

## 11. Problemas encontrados (resumen)

| # | Hallazgo | Severidad | Estado |
|---|---|---|---|
| 1 | `requireAuth` aceptaba tokens de afiliado/PENDING_2FA, fuga cross-company confirmada en `/notifications` | **CRÍTICO** | Corregido |
| 2 | `referralCode: null` rompía TODO registro público sin afiliado | **CRÍTICO** | Corregido |
| 3 | Condición de carrera en transición de estado de comisión/afiliado | IMPORTANTE | Corregido |
| 4 | Cambio de estado + auditoría no atómicos | IMPORTANTE | Corregido |
| 5 | Errores de acción no se mostraban en la administración de afiliados | IMPORTANTE | Corregido |
| 6 | Índice dedicado faltante para filtrar comisiones solo por estado | MEJORA FUTURA | No corregido (no bloqueante) |
| 7 | Posible artefacto de 2px de sub-píxel en el tablero del afiliado a 390px | MEJORA FUTURA | No corregido (no reproducible como defecto visible) |

## 12. Correcciones realizadas

1. `src/core/auth/auth.middleware.js` — `requireAuth` ahora rechaza
   cualquier payload con `type` o sin `userId`/`companyId`.
2. `src/core/auth/auth.validator.js` — `signupSchema.referralCode` ahora
   `.nullable()`.
3. `src/core/affiliates/affiliate-admin.service.js` —
   `transitionCommissionStatus`/`setAffiliateStatus` ahora usan
   `updateMany` condicional + `prisma.$transaction` con la auditoría
   dentro.
4. `frontend/src/pages/affiliates/AffiliateAdminPage.jsx` — captura y
   muestra errores de acción (`actionError`).
5. Tests nuevos: `auth.middleware.test.js` (+4),
   `auth.validator.test.js` (+3, archivo nuevo),
   `affiliates.integration.test.js` (+1 de concurrencia).

## 13. Riesgos pendientes

- Ninguno de severidad CRÍTICA ni IMPORTANTE.
- **MEJORA FUTURA**: índice dedicado en `AffiliateCommission.status`
  si el volumen de comisiones crece lo suficiente para que importe.
- **MEJORA FUTURA**: investigar el diferencial de 2px de `scrollWidth`
  a 390px si llega a reproducirse como un defecto visible real (hoy no
  lo es).
- Limitaciones ya documentadas en `AFFILIATE_SYSTEM_FINAL.md` (sin
  pasarela de pago real, sesión de afiliado no revocable, un solo
  evento de comisión hoy) siguen siendo decisiones de producto
  explícitas, no riesgos técnicos.

## 14. Decisiones arquitectónicas importantes (de esta auditoría)

- **La corrección de seguridad se hizo en UN SOLO punto** (`requireAuth`),
  no ruta por ruta — es la única puerta de entrada real de toda sesión
  de empresa, así que cualquier endpoint presente o futuro que use
  `requireAuth` queda protegido automáticamente, sin tener que
  recordarlo cada vez que se agregue un endpoint nuevo.
- **La atomicidad de auditoría se igualó al patrón ya establecido**
  (`$transaction` + pasar `tx` a `audit.service.log`) en vez de inventar
  un mecanismo nuevo — consistencia con el resto del proyecto.
- **No se tocó ningún modelo de datos en esta auditoría** — los 2
  hallazgos críticos y los 3 importantes fueron de código (middleware,
  validador, servicio, frontend), no de schema. El schema de Afiliados
  se auditó completo (sección 5) y se confirmó correcto tal como se
  diseñó.

## 15. Estado final del producto

**Cerrado, sin problemas críticos conocidos.** Arquitectura Company/
Global/Affiliate validada y coherente. Aislamiento multiempresa
validado (y reforzado por el fix de 4.1, que además protege contra
clases de ataque que ni siquiera existían antes de esta fase — el
`PENDING_2FA`). Afiliados funcionando de punta a punta, con el registro
público normal de empresas restaurado (7.1) y con las acciones
administrativas de comisiones ahora concurrency-safe y completamente
auditadas. 746/746 tests, lint y build limpios, Playwright
end-to-end verificado tres veces (una por cada ronda de correcciones) sin
regresiones en Landing, Acceso, Registro, Panel principal, Ventas,
Clientes, Proveedores, Inventario, Finanzas, Contabilidad, Tesorería,
Niveles de Acceso y Afiliados.
