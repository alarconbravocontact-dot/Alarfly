# Sistema de Afiliados — Documentación Final

## 1. Qué existía previamente

Auditoría exhaustiva antes de escribir código (confirmada con `grep` en todo
`src/`, `frontend/src/` y `prisma/schema.prisma`, nunca "no aparece en el
menú así que no existe"): **no existía absolutamente nada** relacionado con
`affiliate`/`referral`/`referido`/`comisión`/`partner`/`afiliado` en el
proyecto. Los únicos resultados de esa búsqueda fueron falsos positivos ya
existentes sin relación (comisiones **bancarias** de Tesorería, "proveedor
preferido" de Inventario, un comentario sobre "usuario afiliado a una
empresa" en Consolidación). Tampoco existía ningún concepto de:

- Suscripción/plan/facturación del propio SaaS de Alarfly (`Subscription`,
  `Plan`, `Billing` — ninguno existe; el precio ($25/mes) de la Landing es
  únicamente texto comercial, nunca un cobro real en código).
- Un actor "por fuera" de una empresa cliente — **cada modelo del schema
  cuelga de `Company`**, incluido `User`. No hay ningún concepto de
  "administrador de la plataforma Alarfly" distinto de "Administrador de
  una empresa cliente".

Esto significa que el Sistema de Afiliados es, por construcción, la
**primera pieza de plataforma** del proyecto: no hay ningún módulo de
negocio existente al cual extender — tuvo que crearse desde cero, pero
reutilizando toda la infraestructura transversal posible (autenticación,
auditoría, convenciones de API) en vez de duplicarla.

## 2. Qué se reutilizó

- **bcrypt + JWT** (mismo patrón exacto de `core/auth`): mismo
  `JWT_SECRET`, mismo `jsonwebtoken`, mismo `bcryptjs`. El payload del
  token de afiliado es deliberadamente de otra forma (`{affiliateId, type:
  'affiliate'}`, nunca `userId`/`companyId`) para que jamás pueda
  confundirse con un token de sesión de empresa.
- **`assertStrongPassword`** (`core/account/services/security.rules.js`):
  la misma validación de fortaleza de contraseña que ya usa Mi Cuenta y el
  registro público de empresas — no se duplicó esa regla.
- **`core/audit`**: el afiliado usa el mismo `AuditLog`/`audit.service.log()`
  de siempre, nunca un sistema de auditoría paralelo (ver sección 11).
- **Zod + `validate` middleware + `asyncHandler` + `AppError`**: mismos
  cuatro mecanismos que usa cada endpoint del proyecto, sin excepción.
- **Frontend**: mismas clases CSS (`login-*` de `LoginPage.css`, `.btn`,
  `.data-table`, `.page`/`.page-header`), mismos componentes de
  `core/ui`/`components` (`StatCard`, `StatusSeal`, `EmptyState`,
  `Breadcrumb`, `Icon`, `useConfirm`, `useToast`), mismo patrón de
  `AuthContext`/`ProtectedRoute` (espejado, nunca reescrito desde cero).

## 3. Qué se extendió (nunca duplicado)

- **`AuditLog.companyId`** pasó de obligatorio a opcional (cambio aditivo,
  sin tocar `onDelete: Cascade` — ver sección 10). Las ~100 llamadas
  existentes a `audit.service.log()` siguen pasando `companyId` real sin
  ningún cambio de comportamiento.
- **`core/audit/audit.service.js`** ganó una función nueva,
  `listForEntityTypesAnyCompany`, para el único caso legítimo de leer
  auditoría SIN filtrar por empresa (el historial cruzado del programa de
  afiliados) — las funciones existentes (`listForCompany`/`listForEntity`)
  no se tocaron.
- **`core/auth/auth.service.signup`** ganó un parámetro opcional
  `referralCode`: dentro de la MISMA transacción `$transaction` que ya
  crea la `Company`+`User` nuevos, se intenta la atribución del referido
  (mejor-esfuerzo, nunca bloquea el registro). `auth.validator.js`/
  `auth.controller.js` se extendieron en una línea cada uno para
  aceptar/reenviar ese campo opcional.
- **`User`** ganó un campo (`isAffiliateProgramAdmin`) y una relación
  opcional (`affiliateProfile`) — ningún campo ni índice existente se
  tocó.
- **`Company`** ganó una relación opcional (`affiliateReferral`).
- **Frontend**: `AuthContext.signup` ganó un parámetro opcional
  `referralCode`; `SignupPage.jsx` lo lee de `referralCapture.js`;
  `Icon.jsx` ganó 6 íconos nuevos (`copy`, `share`, + los 4 que ya traía
  Fase Landing); `module.css`/`LoginPage.css` ganaron 2 clases genéricas
  (`.login-link-button`, ya documentadas); `App.jsx`/`AppLayout.jsx`
  ganaron rutas y 2 ítems de navegación condicionales.
- **Landing**: un único enlace nuevo en el footer ("Gana dinero
  recomendando Alarfly" → `/afiliados`) — Hero, propuesta de valor,
  estructura, estilos y CTAs existentes **no se tocaron**, tal como pedía
  explícitamente la instrucción 12.

## 4. Qué se creó

**Backend** (`src/core/affiliates/`, nuevo — módulo de PLATAFORMA, no de
negocio, por eso vive en `core/` y no en `modules/`):

- `affiliates.rules.js` — funciones puras (código de afiliado,
  autorreferido, cálculo de comisión con `Prisma.Decimal`, transiciones de
  estado permitidas).
- `affiliate-auth.service.js` / `affiliate-auth.middleware.js` —
  autenticación propia del afiliado (registro, login, JWT de 30 días sin
  sesión revocable — ver limitaciones).
- `affiliate-admin.middleware.js` — puerta de la administración cruzada
  (`requireAffiliateProgramAdmin`), reutiliza la sesión de empresa
  existente, nunca una tercera forma de loguearse.
- `affiliates.service.js` — el punto central de atribución
  (`attributeReferral`, llamado desde `auth.service.signup`), más el
  tablero del propio afiliado (enlace, resumen, referidos, comisiones).
- `affiliate-settings.service.js` — configuración de comisión (fila
  única de plataforma).
- `affiliate-admin.service.js` / `affiliate-admin.controller.js` /
  `affiliate-admin.routes.js` — administración cruzada (listar afiliados/
  comisiones, cambiar estados, configurar tasa, auditoría).
- `affiliates.controller.js` / `affiliates.validator.js` /
  `affiliates.routes.js` — endpoints públicos y del propio afiliado.
- `affiliates.rules.test.js` (13 tests unitarios) y
  `affiliates.integration.test.js` (7 pruebas de integración contra
  Postgres real).

**Frontend** (`frontend/src/pages/affiliates/`, `frontend/src/api/`,
`frontend/src/context/`, nuevos):

- `AffiliateAuthContext.jsx` + `api/affiliateAuth.js` + `api/affiliates.js`
  — sesión y cliente HTTP propios del afiliado (token separado, nunca
  mezclado con la sesión de empresa).
- `api/affiliate-admin.js` — cliente de administración (usa la sesión de
  empresa normal).
- `AffiliateAccessPage.jsx` (registro/login público), `AffiliateLayout.jsx`
  (caparazón mínimo, no reutiliza `AppLayout`), `AffiliateDashboardPage.jsx`
  (tablero del afiliado), `AffiliateAdminPage.jsx` (administración
  cruzada), `AffiliateProtectedRoute.jsx`, `affiliateStatusLabels.js`
  (única fuente de etiquetas/tonos, compartida por ambas pantallas).
- `utils/referralCapture.js` — captura del `?ref=` con ventana de 30 días
  y regla de "último código gana".

**Base de datos** (migración `20261003155636_affiliate_system`, puramente
aditiva): `Affiliate`, `AffiliateReferral`, `AffiliateCommission`,
`AffiliateProgramSettings` + los 2 campos/relaciones de `User`/`Company`
+ el cambio de nulabilidad de `AuditLog.companyId`.

## 5. Arquitectura final

El programa de afiliados opera a nivel de **plataforma**, fuera del límite
multiempresa que organiza el resto del proyecto. Un afiliado:

- **No es un `User`** (no tiene `companyId`, no pasa por `core/rbac`).
- Tiene su **propia autenticación** (`Affiliate`, JWT con `type: 'affiliate'`).
- Opcionalmente se **vincula** (solo informativo) a un `User` existente si
  se registra con el mismo correo — nunca da acceso cruzado en ningún
  sentido.

La administración del programa reutiliza la sesión de empresa existente
(`requireAuth`) más una puerta nueva y angosta
(`requireAffiliateProgramAdmin`, un flag explícito en `User`, nunca un rol
nuevo ni una extensión del RBAC por-empresa — ver sección 16, "Decisiones
tomadas").

## 6. Modelos

```
Affiliate                 (id, email, passwordHash, name, phone, code, status, linkedUserId?)
AffiliateReferral         (affiliateId, referredCompanyId [UNIQUE], codeUsed, attributedAt)
AffiliateCommission       (affiliateId, referralId, eventType, baseAmount, rateType, rateValue,
                            amount, currency, status, statusNote?, approvedAt?, paidAt?)
                           UNIQUE [referralId, eventType]
AffiliateProgramSettings  (rateType, rateValue, referenceAmount, currency)  — fila única
User.isAffiliateProgramAdmin  Boolean
User.affiliateProfile         Affiliate?  (1 a 1, opcional)
Company.affiliateReferral     AffiliateReferral?  (1 a 1, opcional)
AuditLog.companyId            ahora opcional (String?)
```

## 7. Endpoints

**Públicos** (`/affiliates/*`):
`POST /register`, `POST /login`.

**Del propio afiliado** (requieren `Authorization: Bearer <token de
afiliado>`): `GET /affiliates/me`, `GET /affiliates/me/link`,
`GET /affiliates/me/summary`, `GET /affiliates/me/referrals`,
`GET /affiliates/me/commissions?status=`.

**Administración cruzada** (`/affiliate-admin/*`, requieren sesión de
empresa + `isAffiliateProgramAdmin`):
`GET /am-i-admin` (fuera de la puerta, mismo criterio que
`/access-levels/my-permissions`), `GET /affiliates`,
`GET /affiliates/:id`, `PATCH /affiliates/:id/status`,
`GET /commissions`, `PATCH /commissions/:id/status`, `GET /settings`,
`PATCH /settings`, `GET /audit-trail`.

**Integrado en el registro existente**: `POST /auth/signup` ganó el campo
opcional `referralCode`.

## 8. Flujo de atribución

1. El afiliado se registra → recibe un `code` único (`AF-XXXXXX`, alfabeto
   sin `0/O/1/I` para evitar confusión al transcribir a mano).
2. El frontend arma el enlace completo **en el navegador**
   (`window.location.origin + '/registro?ref=' + code`) — nunca en el
   backend (ver bug real corregido, sección 13).
3. Un visitante abre el enlace → el frontend captura `?ref=` en
   `localStorage` con fecha (ventana de 30 días, "último código gana" si
   visita varios enlaces).
4. Al completar `POST /auth/signup`, el código viajero se manda tal cual.
5. Dentro de la MISMA transacción que crea la `Company`+`User`:
   - Si el código no existe o el afiliado está `SUSPENDED` → no pasa nada
     (el registro se completa igual, sin atribución).
   - Si el correo del afiliado coincide con el correo que se está
     registrando (autorreferido) → no pasa nada.
   - Si no, se crea `AffiliateReferral` (con `referredCompanyId @unique`
     — una empresa queda atribuida a lo sumo UNA vez, para siempre, por
     restricción de base de datos, no solo de código) y se genera la
     comisión (sección 9).
6. "Ya estaba asociada a otro afiliado" es estructuralmente imposible: la
   atribución solo puede ocurrir en el instante de creación de la
   empresa, que ocurre una sola vez.

## 9. Flujo de comisión

El único evento real y verificable hoy es el `SIGNUP` — el proyecto nunca
ha tenido facturación/cobro real de su propio SaaS, así que no existe
ninguna señal de "pago confirmado" a la cual enganchar la comisión sin
inventar una integración ficticia (prohibido explícitamente en la
instrucción). Por eso:

- Al generarse la atribución, se calcula el monto con un **snapshot** de
  `AffiliateProgramSettings` (tipo FLAT o PERCENTAGE, con `Prisma.Decimal`,
  nunca floats) — un cambio de tasa después NUNCA recalcula una comisión
  ya generada.
- Idempotencia garantizada en base de datos:
  `@@unique([referralId, eventType])` — el mismo evento del mismo
  referido nunca puede generar dos comisiones.
- El monto **siempre se calcula en el servidor** — ningún endpoint acepta
  un monto desde el cliente.

## 10. Estados de la comisión

```
PENDING → APPROVED → PAYABLE → PAID        (camino normal)
PENDING / APPROVED / PAYABLE → CANCELLED   (en cualquier punto antes de pagar)
PAID y CANCELLED son terminales (ninguna salida)
```

Cada transición exige una acción explícita de un Administrador de
Plataforma (`PATCH /affiliate-admin/commissions/:id/status`) — nunca se
marca "pagada" automáticamente solo por generarse, tal como exigía
explícitamente la instrucción 4. La función pura
`assertCanTransitionCommission` (con tests exhaustivos de cada salto
inválido) es la única autoridad de qué transición es legal; el frontend
solo ofrece los botones de las transiciones que el backend aceptaría,
pero el backend las revalida siempre, nunca confía en el frontend.

## 11. Permisos

- **Endpoints públicos** (`/affiliates/register`, `/login`): sin
  autenticación, por diseño.
- **Endpoints del propio afiliado**: `requireAffiliateAuth` — un afiliado
  solo puede ver SUS PROPIOS referidos/comisiones (todas las consultas
  filtran por `req.affiliateAuth.affiliateId`, nunca por un id recibido
  del cliente).
- **Administración cruzada**: `requireAuth` (sesión de empresa) +
  `requireAffiliateProgramAdmin` (flag leído fresco de la base en cada
  petición, nunca cacheado en el JWT — para que revocarlo a mano surta
  efecto de inmediato, mismo criterio que `requireAccessManagement` ya
  usa en Niveles de Acceso).
- **Integración en `POST /auth/signup`**: sin cambio de permisos (sigue
  siendo público), el campo `referralCode` es opcional y mejor-esfuerzo.

## 12. Auditoría

Reutiliza `core/audit` sin excepción — no se creó ningún sistema de
auditoría nuevo. Acciones registradas:
`affiliate.registered`, `company.referred_by_affiliate` (en la bitácora
de la EMPRESA referida, con su `companyId` real),
`affiliate.referral_attributed` (en la bitácora cruzada del programa,
`companyId: null`), `affiliate_commission.status_changed`,
`affiliate.status_changed`. El historial cruzado se consulta con
`GET /affiliate-admin/audit-trail`.

## 13. Reglas implementadas / bugs reales encontrados y corregidos

- **Autorreferido**: ignorado silenciosamente (el registro se completa,
  nunca se atribuye) — 3 tests de integración lo confirman.
- **Múltiples enlaces**: "último código gana" (last-touch), implementado
  en `referralCapture.js`.
- **Abandona y vuelve**: ventana de 30 días en `localStorage`; pasado ese
  plazo, se trata como si nunca se hubiera visto.
- **Código inválido/inexistente**: nunca bloquea el registro (mejor
  esfuerzo), confirmado con un test de integración dedicado.
- **Idempotencia de referido y de comisión**: ambas protegidas con
  restricciones `@unique` de base de datos, no solo con lógica de
  aplicación — confirmado intentando violar cada una directamente contra
  Prisma en los tests de integración.
- **Aislamiento entre afiliados**: confirmado con un test dedicado (un
  afiliado nunca ve referidos/comisiones de otro).
- **Bug real #1 (encontrado durante la verificación con Playwright)**: el
  endpoint `GET /affiliates/me/link` intentaba armar la URL COMPLETA del
  enlace en el backend, usando `req.headers.origin` con fallback a
  `req.protocol`+`req.get('host')`. Detrás del proxy de desarrollo de
  Vite ese header no llega intacto — el enlace generado apuntaba al
  propio backend (puerto 3000) en vez del frontend (5173), rompiendo el
  flujo de punta a punta. Corregido devolviendo del backend SOLO el
  `code`, y armando la URL completa en el frontend con
  `window.location.origin` (el único origen que el navegador conoce con
  certeza) — ver `AffiliateDashboardPage.jsx`. La función
  `buildReferralLink` original (ya probada) se eliminó del backend junto
  con su test, por quedar sin ningún uso real tras el fix.
- **Bug real #2 (severidad alta, encontrado en pruebas manuales antes de
  llegar a Playwright)**: `AuditLog.userId` tiene una restricción de
  llave foránea real — las primeras pruebas de integración usaban un
  `userId` de texto inventado (`'platform-admin-test'`) para simular al
  Administrador de Plataforma, y la transición de estado fallaba con una
  violación de llave foránea. No era un bug del servicio: confirma que
  el diseño exige correctamente que quien administra el programa sea un
  `User` real — se corrigió el fixture de prueba para crear un usuario
  real con `isAffiliateProgramAdmin: true`, nunca el servicio.

## 14. Tests ejecutados

- **13 tests unitarios** (`affiliates.rules.test.js`): generación de
  código (formato, alfabeto sin ambigüedades, determinismo),
  autorreferido (insensible a mayúsculas, nunca truena con valores
  faltantes), cálculo de comisión (FLAT, PERCENTAGE, precisión con
  `Prisma.Decimal`), las 4 transiciones válidas y los 3 tipos de
  transición inválida (saltar pasos, retroceder, desde un estado
  terminal).
- **7 pruebas de integración contra Postgres real**
  (`affiliates.integration.test.js`): ciclo completo (registro de
  afiliado → login real → referido real vía `auth.service.signup` →
  comisión generada → aprobar → intento de saltar a PAID rechazado →
  PAYABLE → PAID, con auditoría cruzada confirmada), autorreferido,
  código inválido no bloquea, idempotencia de referido (violación de
  `@unique` confirmada contra Prisma directo), idempotencia de comisión
  (ídem), aislamiento entre afiliados, cancelación con motivo
  (transición terminal confirmada).
- **738/738 tests del proyecto completo** (backend), 0 regresiones —
  `npx jest` corrido de punta a punta después de cada cambio relevante.
- **Lint backend**: 0 errores, 0 warnings.
- **Lint frontend**: mismo baseline de 8 warnings `only-export-components`
  ya existentes en los demás archivos de contexto, ahora 9 (el nuevo
  `AffiliateAuthContext.jsx` sigue el mismo patrón arquitectónico, no es
  un error nuevo).
- **Build frontend**: limpio, 889 módulos.
- **Playwright E2E, flujo completo de punta a punta**: un afiliado se
  registró por la interfaz real, copió su enlace real, un visitante
  nuevo abrió ese enlace real y se registró como empresa nueva, el
  tablero del afiliado (recargado) mostró el referido y la comisión real
  generados por el backend real, un Administrador de Plataforma real
  (`admin@demo.alarfly.com`, con el flag otorgado vía el seed) entró a
  `/admin/afiliados`, vio la comisión en estado "Pendiente" y la aprobó
  con el flujo de confirmación real (`useConfirm`), quedando en
  "Aprobada" — confirmado leyendo el estado real de la tabla después del
  clic, no solo el mensaje de éxito. Un usuario Contador (sin el flag)
  confirmado SIN el enlace "Administración de Afiliados" en su menú
  (verificado en una corrida aislada después de un falso positivo inicial
  causado por reutilizar la misma pestaña del navegador entre dos
  sesiones distintas en el script de prueba); sus intentos directos
  contra los endpoints de administración fueron rechazados con 403 reales
  (confirmado en la consola de red, 6 de 6 llamadas).
- **Responsive**: 390px y 768px verificados en las pantallas de acceso y
  tablero de afiliado — sin desborde horizontal visible en ninguna
  captura; el chequeo automático de `scrollWidth` reportó una diferencia
  de 2px en el tablero a 390px que no se pudo atribuir a ningún elemento
  real (el barrido elemento por elemento con tolerancia de 2px no
  encontró ningún ofensor), documentado como posible artefacto de
  sub-píxel del navegador headless, no un defecto visible.
- **Regresión de pantallas existentes** (Landing, Acceso, Panel
  principal, Contabilidad, Tesorería, Cuentas por Cobrar y Pagar, Ventas,
  Inventario, Finanzas, Niveles de Acceso, Auditoría): recorridas con
  Playwright tras los cambios, 0 errores de consola, `/` con sesión
  sigue mostrando el Panel principal (nunca la Landing), confirmando que
  el único archivo compartido de alto riesgo que se tocó (`AppLayout.jsx`)
  no rompió nada existente.

## 15. Limitaciones (documentadas, no ocultas)

- **No hay pasarela de pago integrada, a propósito** (instrucción
  explícita: "no conviertas el afiliado en un sistema de pagos externo"
  / "no implementes integraciones ficticias"). El estado `PAID` registra
  que el pago se hizo **fuera** del sistema — mismo criterio ya usado en
  todo el proyecto para `ScheduledReport`/`core/alerts.notifyAlert()`
  (el envío real de correo tampoco está implementado, documentado desde
  antes de esta fase).
- **Un solo evento de comisión existe hoy** (`SIGNUP`) porque es el único
  evento real y verificable sin inventar facturación — el enum
  `AffiliateCommissionEventType` queda explícitamente extensible para el
  día que exista un evento de cobro real del propio SaaS.
- **La sesión de afiliado no es revocable** (a diferencia de
  `UserSession` para usuarios de empresa) — un JWT de 30 días que expira
  solo. Un afiliado nunca mueve dinero ni aprueba nada desde su propia
  sesión (solo lee su propio tablero), así que la paridad completa con
  `UserSession` no se justificó para esta primera pieza.
- **Cambiar el código de un afiliado** no está expuesto todavía (se
  genera una sola vez al registrarse).
- **"También es cliente de Alarfly" es solo informativo**: el vínculo
  `linkedUserId` se detecta UNA VEZ al registrarse como afiliado (mismo
  correo que un `User` ya existente) — si una persona crea su cuenta de
  Alarfly DESPUÉS de ya ser afiliado, el vínculo no se actualiza
  retroactivamente. No afecta ninguna funcionalidad real (es solo un dato
  mostrado en el panel de administración), documentado como alcance
  recortado a propósito.

## 16. Decisiones tomadas

- **El programa de afiliados vive en `core/affiliates`, no en
  `modules/`**: no es un módulo de negocio de una empresa cliente, es
  infraestructura de plataforma — mismo criterio ya usado en el proyecto
  para decidir qué vive en `core/` (“todo lo que no es específico de una
  empresa cliente”).
- **Administración del programa = un flag explícito en `User`
  (`isAffiliateProgramAdmin`), nunca un rol nuevo ni una extensión del
  RBAC por-empresa existente**: el proyecto confirmó por auditoría que no
  existe ningún concepto de "administrador cruzado de empresas" — crear
  uno de verdad (un sistema de permisos de plataforma completo) habría
  sido una pieza de arquitectura mucho más grande que lo que esta fase
  pedía. El flag se otorga solo por seed/DB directa, mismo patrón ya
  usado en el proyecto para el primer Administrador de cualquier cosa
  sensible (ej. Niveles de Acceso).
- **`AuditLog.companyId` se volvió opcional** en vez de crear una tabla
  de auditoría paralela para el programa de afiliados — cambio mínimo,
  aditivo, revisado explícitamente para no afectar ninguna fila ni
  consulta existente (las ~100 llamadas actuales siguen pasando
  `companyId` real).
- **El enlace de referido se arma en el navegador, nunca en el
  servidor** — decisión tomada DESPUÉS de encontrar el bug real
  documentado en la sección 13; es además la decisión más simple y
  robusta (el navegador siempre sabe su propio origen con certeza).
- **Comisión = evento `SIGNUP` con snapshot de configuración, estados
  manuales con aprobación explícita de un humano** — la regla comercial
  más honesta posible dado que no existe facturación real del SaaS;
  documentada como configurable (tipo/monto/moneda editables desde la
  administración) en vez de hardcodeada.
- **Afiliado = actor completamente separado de `User`, con su propia
  autenticación** — la única interpretación consistente con la
  instrucción explícita de "no obligues a crear una cuenta de empresa de
  Alarfly únicamente para poder participar como afiliado".

## 17. Pendientes reales

Ninguno bloqueante para que el sistema funcione de punta a punta tal como
se pidió. Quedan documentados como mejoras futuras razonables, no como
trabajo a medias:

- Conectar un evento de comisión real de cobro cuando exista facturación
  del propio SaaS (el enum ya está listo para extenderse).
- Exponer "cambiar mi código de afiliado" si se pide.
- Vincular retroactivamente `linkedUserId` si un afiliado crea su cuenta
  de Alarfly después de ya ser afiliado (hoy solo se detecta al revés).
- Sesión de afiliado revocable (`AffiliateSession`), si en el futuro un
  afiliado llega a tener acciones más sensibles que solo leer su propio
  tablero.
