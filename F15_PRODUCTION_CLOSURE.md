# F15 — Production / SaaS Readiness Closure

## 1. Executive Summary

F15 evaluó si Alarfly puede pasar de aplicación de desarrollo a un
despliegue de producción real y operable como SaaS multiempresa.
Metodología constante en los 3 bloques: auditar → medir → determinar
gap real → implementar solo lo justificado. Resultado: **4 bugs
reales corregidos** (2 ALTOS en Bloque 1, 2 MEDIOS en Bloque 2), y una
arquitectura base (Ledger, RBAC, `core/audit`, `core/jobs`, aislamiento
por `companyId`) confirmada, en los 3 bloques, como ya correcta y
suficiente — sin necesidad de reconstruir nada. Lo que falta para un
despliegue real no es código: son decisiones/infraestructura de
despliegue (proveedor de hosting, dominio real para CORS, estrategia
de backup gestionada) que ningún código puede resolver por adelantado
sin inventar una respuesta falsa.

## 2-6. E11 a E15

No se ejecutó un bloque E11-E15 separado — el pedido del usuario pasó
directamente del Bloque 2 (E6-E10) a este bloque final (E16-E20). Sin
trabajo pendiente de un bloque intermedio que documentar acá.

## 7. E16 — Deployment Readiness

**Backend**: `npm start` (`node src/server.js`) es un comando de
producción real y funcional — arranca Express, conecta a
`DATABASE_URL`, y agenda los 9 cron jobs. **Sin uso de `NODE_ENV` en
todo el código** — no hay ninguna rama de comportamiento
development-only que debiera desactivarse en producción (los mensajes
de error ya son genéricos siempre, sin depender de un flag de
entorno — la decisión correcta, nunca confiar en `NODE_ENV` para
ocultar detalles sensibles). `morgan('dev')` seguiría corriendo igual
en producción (formato coloreado, pensado para consola interactiva,
no para un pipeline de logs) — deuda BAJA, no bloqueante.

**Frontend**: `npm run build` (Vite) confirmado exitoso en este
bloque — 867 módulos, ~335KB gzip en un solo bundle (sin
code-splitting por ruta) — deuda BAJA de performance de carga inicial,
no bloqueante. El cliente HTTP (`frontend/src/api/client.js`) construye
cada petición como `/api${path}` relativo al propio origen del
navegador — **nunca una URL de backend hardcodeada** — lo que significa
que el mismo build sirve para cualquier entorno, pero **requiere que
el despliegue real configure un proxy inverso** que enrute `/api/*`
hacia el backend (mismo patrón que ya usa el proxy de desarrollo de
Vite, solo que a nivel de infraestructura real) — **dependencia de
despliegue explícita, no un bug**.

**Database**: migraciones confirmadas reproducibles de punta a punta
(F15-E7: 47 migraciones aplicadas sin error a una base vacía).

**Seguridad**: sin secretos hardcodeados (confirmado, `.env`
gitignorado); sin stack traces expuestos (confirmado en vivo con 401
en 4 escenarios distintos de auth, todos con mensajes genéricos);
CORS sigue sin restricción de origen (`Access-Control-Allow-Origin: *`
confirmado en vivo) — **dependencia de despliegue explícita**: se
necesita el dominio real de producción para configurarlo, no se
adivina.

**Jobs**: los 9 cron jobs solo se agendan en `server.js` (nunca al
importar `app.js`, que es lo único que cargan los tests) — un reinicio
del proceso no duplica ejecuciones porque `node-cron` no persiste
estado entre reinicios y cada corrida ya es idempotente por diseño
(`createAlertIfNotExists`, chequeos de "ya corrió hoy" en cada
servicio).

**Resultado de E16**: **READY WITH DEPLOYMENT DEPENDENCIES** — el
código está listo; el despliegue real depende de: (1) `DATABASE_URL`
de producción, (2) `JWT_SECRET` real (nunca el valor de ejemplo), (3)
proxy inverso `/api/*` → backend, (4) dominio real para configurar
CORS, (5) estrategia de backup de PostgreSQL gestionada por el
proveedor de hosting.

## 8. E17 — Observability

**Request tracing**: `requestId` (F15-E8) presente en cada respuesta
(`X-Request-Id` + `error.requestId`) y en cada línea de `morgan`,
confirmado en vivo — un error se puede correlacionar con su log real.

**Logs vs. Audit**: separados sin excepción — `core/audit` sigue
siendo el único registro de "qué hizo un usuario" (345 escrituras de
dominio ya auditadas donde corresponde desde F0-F14); el log técnico
nuevo (`errorHandler`) nunca escribe en `AuditLog`, y nunca incluye
body/headers (confirmado con test explícito). Sin información
sensible en logs (contraseñas/JWT/tokens nunca se loguean — `morgan`
no registra el body por diseño de su formato).

**Health**: `/health` (liveness) vs. `/health/ready` (readiness, `SELECT 1`
real) — distinción confirmada en vivo apagando/reencendiendo Postgres
(F15-E9).

**Jobs**: `core/jobs` (`JobRun`, `/jobs/status`, `/jobs/runs`) ya
reutilizado tal cual — estado, última ejecución, errores, duración,
aislamiento por empresa, todo ya construido desde antes de F15.

**Métricas**: **sin sistema de métricas externo** (confirmado, cero
dependencias de Prometheus/Grafana/DataDog/etc.) — no se instala uno
sin necesidad real demostrada. Métricas mínimas necesarias para
producción, documentadas pero NO implementadas (dependen de elegir un
proveedor de infraestructura primero): latencia de peticiones, tasa de
error, disponibilidad de base de datos (ya parcialmente cubierta por
`/health/ready`), fallos/duración de jobs (ya cubierto por
`core/jobs`, solo falta exportarlo a un sistema externo si se elige
uno), usuarios activos, throughput de documentos, uso de
almacenamiento (no aplica hoy — sin storage externo, todo vive en
Postgres).

**Resultado de E17**: observabilidad interna (request tracing, health,
jobs, logs separados de audit) ya construida y suficiente para operar
sin un proveedor externo. Métricas agregadas/dashboards de
infraestructura quedan como dependencia de despliegue, no como código
faltante.

## 9. E18 — Security Hardening Final

**Authentication**: JWT con expiración (8h por defecto,
`config.jwtExpiresIn`), bcrypt para contraseñas, sesiones reales con
revocación (`UserSession.revokedAt`), **desde F15-E2/E3**: sesión
revocada al desactivar/cambiar rol, bloqueo de cuenta tras 5 intentos
fallidos. Confirmado en vivo (este bloque): sin token → 401
`NOT_AUTHENTICATED`; token manipulado → 401 `INVALID_TOKEN`; firma
inválida → 401 `INVALID_TOKEN`; token expirado (firmado con el
`JWT_SECRET` real pero `exp` en el pasado) → 401 `INVALID_TOKEN` — los
4 casos con mensajes genéricos, sin distinguir la causa exacta al
cliente (mismo criterio anti-enumeración ya usado en login).

**Authorization/RBAC**: confirmado extensamente en F14 (E22) y F15 —
los 4 roles (`ADMIN`/`ACCOUNTANT`/`FINANCE`/`COLLABORATOR`) ya
probados en vivo contra endpoints reales, rechazos correctos por rol y
por módulo.

**Multiempresa/Cross-company/IDOR/BOLA**: reconfirmado — **0 rutas en
todo el proyecto usan un id de empresa/usuario/cliente/documento como
parámetro de URL con resolución directa sin `companyId`** (patrón
`findFirst({id, companyId})` generalizado, 345 funciones de servicio
con `companyId` como primer parámetro). Validado en vivo repetidas
veces (F14-E1/E3/E8/E22): intento cross-company rechazado, sin fuga.

**Inputs**: Zod en la validación de cada endpoint de escritura, ya
confirmado en las auditorías de F13/F14 — sin cambios necesarios.

**Exports**: PDF/Excel/CSV ya confirmados aislados por `companyId`
(F14-E22, exportación de una empresa nunca menciona el id de otra).

**Files**: sin filesystem/storage externo — todo documento vive en
base64 dentro de tablas ya scoped por empresa; sin superficie de path
traversal porque no hay ningún path de archivo que resolver.

**Security headers**: confirmado en vivo — `helmet()` sin
configuración adicional ya entrega CSP, COOP, CORP, HSTS,
X-Content-Type-Options, X-Frame-Options, Referrer-Policy, todos con
valores por defecto razonables. Sin paquetes nuevos agregados.

**Error handling**: confirmado (F13, reconfirmado en vivo este
bloque) — nunca stack traces/SQL/paths internos/secretos en ninguna
respuesta, en ningún escenario probado.

### Matriz de seguridad final

| Área | Estado | Hallazgo | Acción |
|---|---|---|---|
| Auth | ✅ | Sesión no se revocaba al desactivar/cambiar rol; sin protección de fuerza bruta | Corregido en F15-E2/E3 |
| RBAC | ✅ | Ninguno nuevo | — |
| Multiempresa | ✅ | Ninguno nuevo (el único de todo F14/F15, `setParentCompany`, ya corregido en F14-E1) | — |
| IDOR/BOLA | ✅ | 0 rutas con id como parámetro de URL sin `companyId` | — |
| Inputs | ✅ | Ninguno | — |
| Exports | ✅ | Ninguno | — |
| Files | ✅ | No aplica (sin storage externo) | — |
| Errors | ✅ | Ninguno | — |
| Headers | ✅ | Ninguno (`helmet()` ya suficiente) | — |

## 10. E19 — SaaS Production Readiness

**Tenant isolation**: reconfirmado el flujo completo `Company →
UserCompanyAccess → req.auth.companyId → consultas de dominio →
Ledger/Finance/Operaciones`, sin ningún punto que se salte
`companyId`.

**Data ownership**: mapa completo ya construido en
`F14_ENTERPRISE_CLOSURE.md` sección 4 — no se duplica acá.

**User lifecycle**: creación (invitación, `access-levels`), activación
(`acceptInvitation`), desactivación (**ahora con revocación de sesión
real**, F15-E2), cambio de rol (**ahora con revocación de sesión
real**, F15-E2), acceso a varias empresas
(`UserCompanyAccess`/F14-E3), pérdida de acceso (revocar
`UserCompanyAccess`, ya soportado). Eliminación de usuario: **no
existe** (solo desactivación) — decisión consciente ya implícita en
todo el diseño (nunca se borra un `User` con historial de auditoría/
transacciones ligado a él, correcto para integridad de `Ledger`/
`AuditLog`).

**Company lifecycle**: creación (vía seed/migración hoy, sin un
"crear empresa" self-service — correcto, F16 es responsable de
onboarding comercial); configuración (`Company.*`, ya completa);
usuarios/datos (ya cubierto); **eliminación/soft-delete: NO EXISTE**
(deuda ya documentada en F15-E7, confirmada de nuevo acá — un
`Company.delete` sería irreversible salvo por un backup externo, y no
hay ningún flujo que lo dispare hoy) — **no se implementa**, sin caso
de negocio real que lo demande todavía.

**Capacity**: límites técnicos/de seguridad ya documentados en
F15-E5 (payload 5MB, sin límite de filas de import, sin
rate-limiting general). Sin límites comerciales — corresponden a F16.

**Dependencias SaaS, separadas**:
- **YA RESUELTO**: aislamiento multiempresa, RBAC, auditoría, sesión/
  revocación, bloqueo de fuerza bruta, health/readiness, request
  tracing, migraciones reproducibles.
- **DEPENDIENTE DEL DEPLOYMENT**: `JWT_SECRET` real, `DATABASE_URL`
  real, CORS con dominio real, proxy `/api/*`, backup gestionado de
  PostgreSQL, sistema de métricas externo si se decide adoptar uno.
- **F16** (explícitamente NO tocado en F15): billing, subscriptions,
  pricing, trial, onboarding comercial, activation, growth, landing,
  affiliates.

## 11. E20 — Final Production Audit & Closure

Auditoría transversal ejecutada en vivo en este bloque (más la
evidencia ya acumulada de F14/F15 Bloques 1-2, no repetida
innecesariamente):

1. **Multiempresa**: acceso cruzado probado y rechazado repetidas
   veces en F14-E22/F15 — reconfirmado sin cambios.
2. **RBAC**: 4 roles ya probados en vivo (F14-E22).
3. **Auth**: sin token/token inválido/firma incorrecta/token
   expirado — los 4 confirmados en vivo en este bloque, los 4 con 401
   y mensaje genérico.
4. **Database**: migraciones reproducibles (F15-E7), transacciones
   (`$transaction` en cada operación crítica, ya establecido desde
   F0), aislamiento (`companyId` en cada consulta).
5. **Ledger**: único punto de escritura (`core/ledger.postEntry`),
   sin cambios en todo F15 — **no se modificó**, tal como exige el
   bloque salvo hallazgo crítico real (no hubo ninguno).
6. **Jobs**: 9 crons, `companyId` explícito por iteración, auditados
   vía `core/jobs`, sin duplicación (idempotencia ya verificada desde
   F12-A/F14).
7. **Health**: `/health` y `/health/ready` probados ON/OFF/ON en vivo
   (F15-E9, reconfirmado): DB apagada → `/health` 200, `/health/ready`
   503; DB reencendida → ambos 200.
8. **Logging**: `requestId` + error + log correlacionados,
   confirmado en vivo (F15-E8/este bloque).
9. **Exports**: PDF/Excel/CSV aislados por empresa (F14-E22).
10. **Frontend**: `npm run build` exitoso en este bloque (867 módulos,
    sin errores); sin URL de backend hardcodeada; sin endpoint de
    desarrollo expuesto (el proxy de Vite solo existe en modo `dev`,
    nunca en el build de producción).
11. **Performance**: sin problema que impida producción — el único
    hallazgo (bundle único sin code-splitting, ~335KB gzip) es una
    optimización futura, no un bloqueo.
12. **Continuity**: backup/restore/RPO/RTO — **PENDIENTE DE
    INFRAESTRUCTURA**, tal como se documentó honestamente en F15-E6/E7,
    reconfirmado sin cambios.

### Matriz final de riesgo

| Severidad | Cantidad | Detalle |
|---|---|---|
| **CRITICAL** | 0 | — |
| **HIGH** | 0 | Los 2 únicos ALTOS de todo F15 (sesión no revocada, sin protección de fuerza bruta) ya se corrigieron en el Bloque 1 |
| **MEDIUM** | 0 | Los 2 únicos MEDIOS de todo F15 (sin request tracing, sin readiness real) ya se corrigieron en el Bloque 2 |
| **LOW** | 3 | Bundle frontend sin code-splitting; `morgan('dev')` sin formato JSON para producción; bloqueo de login por cuenta no por IP (trade-off aceptado) |
| **DEBT** | 4 | Sin soft-delete de `Company`; sin límite de filas de import; CORS sin dominio de producción conocido; sin sistema de métricas externo |

Todos los MEDIUM quedaron resueltos dentro del propio F15 (no quedó
ninguno pendiente sin aceptar explícitamente) — cumple la condición
del bloque ("los MEDIUM solamente pueden permanecer si están
explícitamente aceptados y documentados": acá no queda ninguno sin
resolver que requiera esa aceptación).

## 12. Architecture diagram

```
NAVEGADOR
   │
   ▼
FRONTEND (React/Vite, build estático)
   │  fetch('/api/...') — relativo al propio origen, sin URL hardcodeada
   ▼
[ PROXY INVERSO — dependencia de despliegue, no construido en código ]
   │
   ▼
BACKEND (Express, Node — npm start)
   ├── requestId → morgan (log correlacionable)
   ├── helmet + cors (headers de seguridad; CORS abierto, pendiente de dominio real)
   ├── requireAuth (JWT + UserSession.revokedAt)
   ├── requireModuleAccess / requireRole (RBAC)
   ├── Servicios de dominio (companyId explícito, 345 funciones)
   │      ├── core/ledger (único punto de escritura contable)
   │      ├── core/audit (único registro de auditoría)
   │      ├── core/rbac (roles + UserCompanyAccess)
   │      ├── core/fx (única fuente de tasas)
   │      └── core/jobs (observabilidad de los 9 cron jobs)
   ├── errorHandler (nunca expone detalles internos; requestId en toda respuesta)
   ├── GET /health (liveness) / GET /health/ready (readiness real)
   ▼
POSTGRESQL (única fuente de verdad de datos — 118 tablas, 47 migraciones reproducibles)
   [ backup/restore gestionado — dependencia de infraestructura, no construido ]
```

## 13. Security matrix

Ver sección 9.

## 14. Multi-company isolation

Ver secciones 9/11 — `Company` es el tenant real (confirmado desde
F15-E1), aislamiento verificado en vivo repetidas veces a lo largo de
F14 y F15.

## 15. Database status

PostgreSQL 16, 118 tablas, 47 migraciones aplicadas y reproducibles
(probado desde cero en F15-E7). Sin incompatibilidades encontradas.

## 16. Backup status

**No existe backup real hoy** — entorno de desarrollo sin
infraestructura de producción desplegada. Documentado honestamente
desde F15-E6, no fabricado.

## 17. Recovery status

Schema/estructura: restaurable, probado en vivo (F15-E7, 47
migraciones desde cero). Datos: depende de que exista un backup real,
que no existe todavía.

## 18. RPO/RTO status

**PENDIENTE DE INFRAESTRUCTURA** — sin números inventados. Se
definirán cuando exista un proveedor de despliegue real con una
política de backup concreta.

## 19. Health checks

`GET /health` (liveness, sin DB) y `GET /health/ready` (readiness,
`SELECT 1` real) — ambos construidos y probados en vivo, incluido el
escenario DB apagada/reencendida.

## 20. Observability

Ver sección 8.

## 21. Jobs

`core/jobs` (`JobRun`, `/jobs/status`, `/jobs/runs`), 9 cron jobs, cada
uno ya scoped por empresa, con idempotencia y auditoría — sin cambios
en F15 (ya suficiente).

## 22. Storage

Sin storage externo — todo documento vive en base64 dentro de
Postgres, ya scoped por `companyId`. Decisión consciente ya
documentada desde F0.

## 23. Performance

Sin problema que impida producción. Un hallazgo LOW (bundle sin
code-splitting) documentado, no corregido sin evidencia de que afecte
a usuarios reales.

## 24. Capacity

Ver F15-E5 (Bloque 1) — límites técnicos/de seguridad documentados,
límites comerciales explícitamente fuera de alcance (F16).

## 25. Tests

707/707 (línea base al cierre de F15 — sin cambios de código en este
bloque final, por lo que no se agregaron tests nuevos; regresión
completa reconfirmada limpia).

## 26. Real validation

Este bloque: build de frontend confirmado exitoso; headers de
seguridad confirmados en vivo (`curl -I`); 4 escenarios de
autenticación (sin token/inválido/firma incorrecta/expirado)
confirmados en vivo, los 4 con 401 y mensaje genérico. Bloques
anteriores (reutilizados, no repetidos): F15-E2/E3 (sesión revocada,
bloqueo de login), F15-E7 (restauración de schema desde cero),
F15-E9 (health/readiness con Postgres apagado/reencendido), F14-E22
(RBAC de 4 roles, cross-company, exports, jobs aislados, auditoría).

## 27. Risks

Ver matriz de sección 11 — CRITICAL: 0, HIGH: 0, MEDIUM: 0 (todos
resueltos dentro de F15), LOW: 3, DEBT: 4.

## 28. Technical debt

Sin soft-delete de `Company`; sin límite de filas por import; CORS sin
dominio de producción conocido; sin sistema de métricas externo;
bundle frontend sin code-splitting; `morgan('dev')` sin formato JSON;
bloqueo de login por cuenta (no por IP).

## 29. Deployment dependencies

`JWT_SECRET` real; `DATABASE_URL` de producción; proxy inverso `/api/*`
→ backend; dominio real para configurar CORS; estrategia de backup de
PostgreSQL gestionada; (opcional) sistema de métricas externo si se
decide adoptar uno.

## 30. Items explicitly deferred to F16

Billing, subscriptions, pricing, trial, onboarding comercial,
activation, growth, landing, affiliates. Ninguno de estos se tocó en
F15.

## 31. Final decision

**F15 — CERRADA CON DEUDA**

CRITICAL = 0, HIGH = 0 (ambas condiciones de cierre exigidas por el
bloque se cumplen). La deuda restante es exclusivamente LOW o
dependencias normales de un despliegue real (backup gestionado,
dominio de producción, proxy inverso) — ninguna oculta, todas
documentadas explícitamente en este documento.

### Respuesta directa a la pregunta de cierre

1. **Qué está listo**: aislamiento multiempresa, RBAC, autenticación
   (con revocación de sesión real y bloqueo de fuerza bruta), Ledger/
   Audit/FX/Jobs como fuentes únicas de verdad, observabilidad interna
   (request tracing, health/readiness, jobs), seguridad de
   headers/errores/inputs/exports, build de frontend y backend.
2. **Qué depende del deployment**: secretos reales, dominio real
   (CORS), proxy inverso, backup/restore gestionado, RPO/RTO reales.
3. **Qué riesgos quedan**: ninguno crítico ni alto. Los LOW están
   aceptados y documentados.
4. **Qué deuda queda**: 4 puntos DEBT + 3 LOW, todos documentados en
   la sección 28.
5. **Qué NO debe construirse todavía**: backup/monitoring/proveedor
   cloud específico sin elegir despliegue real primero; soft-delete de
   `Company` sin caso de negocio real; rate-limiting general sin un
   endpoint público que lo justifique; código de F16.
6. **Qué corresponde a F16**: billing, subscriptions, pricing, trial,
   onboarding comercial, growth, landing, affiliates — ninguno tocado.
