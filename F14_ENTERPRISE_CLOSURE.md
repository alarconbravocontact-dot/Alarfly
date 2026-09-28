# F14_ENTERPRISE_CLOSURE.md — Multiempresa / Enterprise

> Documento de cierre de F14. Complementa (no duplica) `CLAUDE.md`,
> `PROGRESS_LOG.md`, `AI_ARCHITECTURE.md` e `INTEGRATIONS_ARCHITECTURE.md`.
> Resume el estado final de la arquitectura multiempresa tras las 27
> etapas (E1-E27) de F14.

## 1. Objetivo de F14

Asegurar que Alarfly pueda manejar estructuras empresariales múltiples
y complejas (grupos, matriz/subsidiarias, sucursales, almacenes,
dimensiones, consolidación) de forma segura, coherente y escalable
**cuando el caso de uso lo requiera** — nunca convertir Alarfly en un
ERP Enterprise genérico por defecto. F14 no construyó ninguna
capacidad sin que un gap real, evidenciado en código, lo justificara.

## 2. Arquitectura final: contexto empresarial

```
USUARIO (JWT: userId, companyId, role, sessionId)
   ↓
EMPRESA ACTIVA (req.auth.companyId — nunca confiado del cliente,
                salvo el único caso ya validado: switchActiveCompany)
   ↓
RBAC (requireModuleAccess + requireRole, por rol global)
   ↓
SERVICIO DE DOMINIO (siempre recibe companyId explícito,
                     345 funciones ya siguen este patrón)
   ↓
DATOS (siempre filtrados por companyId + id juntos —
       nunca un id resuelto solo)
```

## 3. Empresas (`Company`)

Modelo único, sin duplicar. Campos Enterprise-relevantes:
`baseCurrency`, `parentCompanyId`/`subsidiaries` (auto-relación
`CompanyGroup`), `fiscalYearStartMonth`, `dueDateWarningThresholdDays`,
`defaultLanguage`/`defaultDateFormat`/`defaultTimeZone`.

## 4. Ownership (mapa final, E24)

| Entidad | Owner | Alcance de empresa | Fuente de verdad | Quién escribe | Quién lee | Autorización |
|---|---|---|---|---|---|---|
| `JournalEntry`/`Account` | Empresa | `companyId` obligatorio | **Ledger** (`core/ledger`, único punto de escritura) | Todos los módulos, siempre vía `postEntry` | Todos con acceso al módulo | RBAC + companyId |
| `Company.parentCompanyId` | La empresa "hija" | — | `Company` misma | `consolidation.service.setParentCompany` | ADMIN | RBAC + `UserCompanyAccess` (F14-E1) |
| `UserCompanyAccess` | El usuario | — | Tabla propia | `company-access.service` (F14-E3) | El propio usuario + ADMIN de la empresa | ADMIN→ADMIN únicamente |
| `Dimension`/`Warehouse` | Empresa | `companyId` obligatorio | Tablas propias | Módulo dueño (Tesorería/Inventario) | Rol del módulo | RBAC + companyId |
| `FpaDimension` | Empresa | `companyId` obligatorio | Tabla propia | FP&A | FP&A/Reportes | RBAC + companyId |
| `AlertRule`/`Alert`/`AuditLog` | Empresa | `companyId` obligatorio | `core/alerts`/`core/audit` | Motor único respectivo | Según módulo | RBAC + companyId |
| `AccountTemplate` | **Nadie — global** | Sin `companyId` | Catálogo de referencia | Nadie vía HTTP | Cualquier sesión | Mínima (solo sesión) |

Ninguna relación de ownership permite saltarse `companyId`: confirmado
por auditoría estática (345 funciones con `companyId` como primer
parámetro, 0 usos de `$queryRaw`/`$executeRaw`, 0 rutas con `companyId`
como parámetro de URL).

## 5. Grupos empresariales (E4)

Matriz→múltiples subsidiarias directas (un nivel), con detección de
ciclos y, desde F14-E1, autorización real (`UserCompanyAccess`) sobre
la empresa matriz elegida. Sin soporte multinivel (nietas) — límite
consciente, sin caso de uso real que lo requiera.

## 6. Sucursales (E5)

`Dimension.type = BRANCH` (core, plana). Sin entidad `Branch` separada.
`Warehouse.branchDimensionId` es un vínculo lateral opcional, nunca
jerárquico. Sin permisos ni reportes transversales por sucursal —
documentado como deuda futura sin caso real.

## 7. Almacenes (E6)

`Warehouse` cuelga directo de `Company`, multi-almacén completo
(transferencias, valoración FIFO/LIFO/PMP, reservas, lotes) ya
construido y probado antes de F14. Aislamiento total confirmado.

## 8. Dimensiones (E7)

Duplicación consciente y documentada: `Dimension` (core, plana) vs.
`FpaDimension` (FP&A, jerárquica). Ambas ya en producción, sin
necesidad de un tercer sistema.

## 9. Consolidación (E8, E10)

`getConsolidatedTrialBalance`: matriz + subsidiarias directas,
eliminación inter-compañía con detalle, **ahora con conversión de
moneda segura** (F14-E8: reutiliza `core/fx.getLatestRate`, nunca
inventa una tasa — si falta, excluye la empresa y lo reporta en
`currenciesWithoutRate`). Limitada a balance de comprobación —
consolidar estado de resultados/balance general/flujo de efectivo
queda documentado como gap (E10), sin caso de uso real todavía.

## 10. Intercompany (E9)

Solo existe marcado manual (`Account.isIntercompany`/
`intercompanyCompanyId`), consumido por la eliminación en
consolidación. Sin motor automatizado de operaciones empresa→empresa
— ningún caso de uso real fue nombrado en todo F14.

## 11. FX Enterprise (E11)

`core/fx` es la única fuente de tasas en todo el sistema, ya
reutilizada de forma consistente por Tesorería, AR/AP y (desde E8)
Consolidación. Nunca se inventa una tasa: todo punto que necesita
convertir excluye/reporta honestamente si no hay una registrada.

## 12. Permisos (E12/E13)

RBAC por rol global (`ADMIN`/`ACCOUNTANT`/`FINANCE`/`COLLABORATOR`),
sin diferenciación por empresa — `User.role` es un solo valor.
Documentado como gap (no implementado): ningún caso de uso real y
concreto lo demandó durante F14.

## 13. Políticas corporativas (E14)

Ya existen como reglas de dominio (aprobación por monto en Tesorería,
bloqueo de periodo, límite de crédito en AR, maker-checker). Sin
Policy Engine genérico — no se demostró necesidad de una capa
corporativa por encima de las reglas de dominio ya existentes.

## 14. Aprobaciones (E15)

`core/workflow/segregation.rules.assertDifferentActors` es el único
mecanismo de maker-checker, reutilizado por Órdenes de Pago, Caja
Chica y Conteos Físicos. Ya respeta aislamiento por empresa (aprobar
en otra empresa exige cambiar la empresa activa, JWT nuevo).

## 15. Reporting (E16)

Todo reporte/exportación parte de `req.auth.companyId`; la
consolidación es el único reporte de grupo, explícito y ADMIN-only.

## 16. Dashboard (E17)

Los 8 widgets de Inicio reciben `companyId` explícito; nunca mezclan
empresas. La vista consolidada vive aparte, en Reportes, nunca en
Inicio.

## 17. Auditoría (E18)

`AuditLog` ya trae los 8 campos mínimos necesarios (empresa, usuario,
cuándo, entidad, acción, antes/después). Las 3 acciones
Enterprise-sensibles construidas en F14 (`company.parent_company_changed`,
`company_access.granted`, `company_access.revoked`) quedan auditadas
— confirmado en vivo (curl) en F14-E1, F14-E3 y F14-E22.

## 18. Jobs (E19)

Los 9 cron jobs ya iteran `prisma.company.findMany` explícitamente,
cada iteración recibe `company.id` propio, con `try/catch` individual
(un fallo nunca bloquea otras empresas). Los endpoints de escaneo
manual (`POST .../scan`) usan `req.auth.companyId` exclusivamente —
confirmado en vivo (E22): un escaneo disparado por la Empresa A no
generó ninguna alerta en B ni C.

## 19. Imports/Exports (E20)

`core/import`/`import-templates` y todos los exportadores ya parten de
`req.auth.companyId`. Confirmado en vivo (E22): la exportación de una
empresa nunca menciona el id de otra.

## 20. Integraciones (E21, frontera con F13)

F13 confirmó cero integraciones externas reales (sin webhooks, sin
API para terceros). Los únicos campos `externalId` del sistema
(`BankTransaction.externalId`, `FiscalElectronicDocument.externalDocumentId`)
están correctamente acotados por empresa — sin ningún camino de fuga
entre F13 y F14.

## 21. Seguridad (E22)

Confirmado en vivo con datos reales (Empresa A/B/C, 4 usuarios, 3
roles): RBAC rechaza correctamente por rol y por módulo; la
autorización de `setParentCompany` sigue rechazando empresas no
relacionadas; ningún endpoint acepta `companyId` como parámetro de
URL (0 resultados en todo el código); un `companyId` ajeno enviado por
query se ignora (el contexto siempre viene del JWT); el otorgamiento
de acceso entre empresas queda auditado con los datos correctos.

## 22. Performance (E23)

Sin problema demostrado. El único punto nuevo de F14
(`getConsolidatedTrialBalance` con conversión de moneda) ya resuelve
la tasa una sola vez por empresa del grupo (no por línea, corregido
antes de este cierre). Sin índice dedicado por `companyId` en
`UserCompanyAccess` para `listGrantedAccess` — sin impacto real a la
escala actual (la tabla crece solo con otorgamientos explícitos
ADMIN→ADMIN), documentado, no corregido sin medición real que lo
justifique.

## 23. Tests (E25)

693/693 tests de backend. Cobertura por categoría: Aislamiento (12+
archivos), Cambio de empresa (`companies.service.test.js`),
Consolidación (`consolidation-security`/`consolidation-currency`),
RBAC (`rbac.middleware.test.js`/`rbac.rules.test.js`), Auditoría
(verificada dentro de los tests de E1/E3), Jobs
(`job-run.integration.test.js`, aísla por empresa). Intercompany e
Integraciones: sin tests porque no existe la capacidad (nada que
probar, documentado, no fabricado).

## 24. Validación real (E26)

Escenario con 3 empresas reales (A, B-subsidiaria EUR, C-ajena) y 4
usuarios de 3 roles distintos, contra Postgres real: login, cambio de
contexto, RBAC negativo, autorización cross-company negativa,
otorgamiento con auditoría real verificada en la base de datos, jobs
aislados, exports limpios — todo documentado en `PROGRESS_LOG.md`.

## 25. Deuda técnica (clasificada)

| Deuda | Severidad |
|---|---|
| Consolidación limitada a balance de comprobación y un nivel | FUTURA / SIN CASO DE NEGOCIO |
| Intercompany sin motor automatizado | FUTURA / SIN CASO DE NEGOCIO |
| RBAC sin diferenciación por empresa | FUTURA / SIN CASO DE NEGOCIO |
| Sin permisos/reportes transversales por sucursal | FUTURA / SIN CASO DE NEGOCIO |
| `UserCompanyAccess` sin índice líder en `companyId` | BAJA |

## 26. Riesgos residuales

Ninguno de severidad CRÍTICA o ALTA. El único hallazgo crítico de todo
F14 (`setParentCompany` sin autorización) se corrigió y verificó en
F14-E1, con cobertura de test y validación en vivo repetida en
E8/E22.

## 27. Estado final de F14

**F14 — CERRADA CON DEUDA** (deuda exclusivamente clasificada como
FUTURA / SIN CASO DE NEGOCIO o BAJA — ninguna crítica ni alta).
