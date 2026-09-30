# F16_GROWTH_AUDIT.md — Métricas, Experimentación, Referidos, Afiliados y Growth Loops (E11–E15)

> **Nota de fuente**: se buscó `Markdown.md`, `ALARFLY_MASTER_UX_UI_REDESIGN.md`
> y `AI_ARQUITECTURA.md` en todo el sistema de archivos de esta sesión —
> ninguno de los 3 existe (búsqueda exhaustiva, cero resultados). Sí
> existe `AI_ARCHITECTURE.md` (nombre en inglés) y se usó como
> referencia real. El detalle comercial del programa de afiliados
> ("Conviértete en aliado de Alarfly", $5 por afiliado referido) viene
> del propio texto del pedido de esta etapa, no de un archivo leído —
> mismo criterio de transparencia ya usado en los bloques anteriores
> de F16 con el cuestionario de landing page. Se leyeron `PROGRESS_LOG.md`,
> `CLAUDE.md`, `frontend/DESIGN_SYSTEM.md`, `F16_COMMERCIAL_FUNNEL_AUDIT.md`,
> `F16_ACTIVATION_CONVERSION_AUDIT.md`, `F14_ENTERPRISE_CLOSURE.md`,
> `F15_PRODUCTION_CLOSURE.md` y `AI_ARCHITECTURE.md` como contexto, y se
> verificó cada afirmación contra el código real (nunca se asumió que
> algo existe solo porque aparece documentado).

## Resumen de método aplicado a las 5 etapas

Para cada etapa se aplicó la cadena exigida: ¿Existe? → ¿Funciona? →
¿Se usa? → ¿Se mide? → ¿Se puede reutilizar? → ¿Se puede extender? →
¿Se debe fusionar? → ¿Realmente hace falta crear? — verificado con
`grep` exhaustivo (con límites de palabra, para evitar falsos
positivos de palabras parecidas, ej. "variant" de `ProductVariant`
contaminando una búsqueda de "experiment variant") sobre `src/`,
`frontend/src/` y `prisma/schema.prisma` completos, nunca sobre una
muestra.

## 1. E11 — Métricas Comerciales

### Qué existe realmente (con evidencia)

| Fuente | Qué mide | Confiabilidad |
|---|---|---|
| `AuditLog` (`core/audit`) | Acciones reales con actor humano: `user.invited`, `user.invitation_accepted`, `user.role_changed`, `user.deactivated`, `user.activated` (confirmado con `grep` de cada `action:` string en `src/`) | Alta — un registro por acción real, nunca inferido |
| `UserSession` | `createdAt` (login real) + `lastSeenAt`, **actualizado en cada petición autenticada** (`auth.middleware.js:38`, confirmado en código, no solo documentado) | Alta — es la señal de actividad más fiable que existe hoy en el sistema |
| `Company.createdAt` | Cuándo se creó una empresa | Alta, pero **sin actor** — las empresas solo se crean por seed hoy (E1-E5), así que no genera `AuditLog` (ese modelo exige `userId`, y el seed no tiene un usuario autenticado que lo dispare) |
| `setup-status.service` (`getSetupStatus`) | 4 señales de activación ya verificadas contra el sistema real (nunca autodeclaradas) | Alta — ya construido y probado en F16-E6/E7 |

### Clasificación pedida (para no mezclar fuentes de verdad)

- **Métricas operativas** (cómo funciona el sistema): `core/jobs`
  (`JobRun`, duración/éxito de crons), `requestId`/log técnico
  (F15-E8) — ya existen, sin relación con lo comercial.
- **Métricas de producto** (cómo se usa el producto): `AuditLog`,
  `UserSession`, `setup-status` — existen, dispersas, nunca agregadas
  en un solo lugar.
- **Métricas comerciales** (crecimiento del negocio de Alarfly:
  visitas, registros, activación, conversión, retención, referidos):
  **no existe ninguna** — no hay ninguna tabla, endpoint ni pantalla
  que agregue las señales de arriba en indicadores comerciales. Cero
  falsos positivos: se confirmó con `grep` que no existe ningún
  `company.count()` expuesto en ninguna ruta, ni ninguna pantalla
  `superadmin`/`platform-admin`/panel interno cruzando empresas.
- **Métricas financieras** (del NEGOCIO DE CADA CLIENTE, no de
  Alarfly): EBITDA/Burn rate/Runway/KPIs de FP&A — ya existen y son
  del cliente, no deben confundirse con métricas comerciales de
  Alarfly. Confirmado que no hay ninguna mezcla entre ambos conceptos
  en el código actual.

### Hallazgo real, sin ambigüedad

**No existe ninguna forma, hoy, de que el dueño de Alarfly (la
plataforma) vea "cuántas empresas se crearon este mes" o "cuántos
usuarios están activos"** sin consultar la base de datos directamente
— porque el 100% del producto está diseñado, correctamente, para que
cada empresa solo vea sus propios datos (aislamiento por `companyId`,
la regla de seguridad número uno de todo el proyecto, reverificada en
F14). Un panel de métricas comerciales de la plataforma es
estructuralmente distinto de cualquier reporte existente: **cruzaría
el límite de aislamiento multiempresa a propósito**, algo que hasta
ahora nunca se había construido ni se debía construir sin una
necesidad real.

### Decisión de esta etapa: NO se construyó nada

No existe todavía ningún registro público, trial ni pago (E1-E5/E8) —
la mayoría de los eventos comerciales de ejemplo del pedido
(`visitor → signup`, `trial → paid`, `referral → signup`) **no tienen
ningún dato real que medir todavía**: no hay visitantes registrados
(sin landing), no hay señales de trial, no hay pagos. Construir un
"panel de métricas comerciales" hoy sería, en la práctica, un panel
casi vacío — la definición misma de "métrica especulativa" que este
bloque prohíbe explícitamente. Se documenta el conjunto mínimo útil
(abajo) para cuando exista el registro público que lo alimente, sin
construir la tabla/endpoint/pantalla por adelantado.

### Conjunto mínimo de métricas comerciales recomendado (documentado, NO implementado)

Justificado exclusivamente con las fuentes que YA existen, sin
inventar ningún dato:

1. `empresas creadas por semana` — de `Company.createdAt` (ya existe).
2. `usuarios invitados vs. aceptados` — de `AuditLog` (`user.invited`
   vs `user.invitation_accepted`, ya existen ambos eventos).
3. `% de empresas con al menos 1 paso de setup completo` — de
   `setup-status.service`, corrida por empresa (ya existe la función,
   falta solo agregarla — no falta construirla).
4. `usuarios con sesión en los últimos 7/30 días` — de
   `UserSession.lastSeenAt` (ya existe y ya se actualiza en vivo).

Las 4 son calculables HOY sin ninguna tabla nueva — la única pieza
que faltaría es una pantalla/endpoint que las agregue **cruzando
empresas**, que es exactamente la pieza que requiere una decisión de
producto explícita (ver "Pendiente de decisión del usuario" al final).

## 2. E12 — Experimentación / A-B Testing

### Búsqueda exhaustiva (con límites de palabra)

`grep -rniE "\bfeatureFlag|feature_flag|\bexperiment\b|abTest|a/b test"`
sobre `src/`, `frontend/src/` y `prisma/schema.prisma` completos:
**cero resultados reales** (la primera pasada, con una regex más
amplia que incluía "variant"/"cohort", devolvió ~40 archivos que
resultaron ser, sin excepción, coincidencias de `ProductVariant`
— el catálogo de variantes de producto de Inventario, sin ninguna
relación con experimentación).

### Determinación de necesidad real

**No existe ninguna necesidad actual de A/B testing.** Un experimento
A/B necesita, como mínimo, dos condiciones que hoy no se cumplen: (1)
suficiente volumen de usuarios pasando por el mismo flujo para que la
diferencia entre variantes sea estadísticamente significativa, y (2)
un flujo público real que experimentar (landing, registro) — ninguna
de las dos existe (E1-E5). Construir una plataforma de
experimentación hoy sería exactamente "A/B testing ficticio", que el
bloque prohíbe explícitamente.

### Qué necesitaría Alarfly cuando exista volumen suficiente (documentado, NO implementado)

- Landing pública + registro público con tráfico real (precondición
  dura — sin esto no hay nada que experimentar).
- Un campo de asignación de variante estable por visitante/usuario
  (ej. hash determinístico del id, para que la misma persona siempre
  vea la misma variante — nunca aleatorio en cada carga).
- Un evento de conversión medible por variante, reutilizando el mismo
  `AuditLog`/futuras métricas comerciales de E11, no un sistema de
  eventos aparte.
- Partes experimentables candidatas, ya identificadas por su
  naturaleza (sin construir nada): copy de la landing (cuando exista),
  el CTA principal, el orden de los pasos del onboarding guiado (ver
  deuda de F16-E6).
- Condición mínima explícita para justificarlo: al menos cientos de
  visitantes/semana pasando por el mismo flujo — por debajo de eso,
  cualquier resultado es ruido, no señal.

## 3. E13 — Referidos

### Búsqueda exhaustiva

`grep -rniE "\breferral|\breferredBy|\breferrer\b"` sobre todo el
proyecto: **cero resultados, en cualquier variante** (código, schema,
tests). No existe ningún campo, modelo, ruta ni componente de
frontend relacionado con referidos.

### Determinación de necesidad real

Un sistema de referidos necesita, por definición, un punto de entrada
público donde un nuevo usuario pueda llegar arrastrado por un código o
enlace de invitación **externo** — y hoy el único "invitar" que existe
es 100% interno: `access-levels.inviteUser` invita a alguien A LA
MISMA EMPRESA (dentro del aislamiento multiempresa, nunca lo cruza),
con cupo por rol y sin ningún concepto de atribución externa. Es un
mecanismo de expansión de equipo, no de referidos comerciales — **no
se debe confundir ni fusionar con lo que pide esta etapa**, aunque
ambos usen la palabra "invitar".

Sin registro público (E1-E5), no existe ningún lugar donde aterrizar
a alguien "referido por Fulano" — la precondición dura es la misma
que en E12.

### Modelo mínimo conceptual (documentado, NO implementado)

Si se decide construirlo cuando exista registro público:
- Un código/enlace de referido por usuario (no por empresa — un
  referido lo genera una PERSONA, aunque pertenezca a una empresa).
- Atribución guardada en el momento del registro del nuevo usuario
  (`referredByUserId` o similar, nunca reescribible después — para
  que no se pueda manipular la atribución una vez ya ocurrió).
- Nunca contarlo como conversión hasta que el referido complete al
  menos el evento de activación ya definido en E7 (no solo el
  registro) — para que un referido "vacío" no infle métricas.
- Reutilizar el mismo `core/audit` para dejar rastro de cada
  atribución, en vez de un sistema de auditoría aparte.

## 4. E14 — Afiliados

### Búsqueda exhaustiva

`grep -rniE "\baffiliate\b|\baliado\b|\bcomisi[oó]n\b|\bcommission\b"`
sobre todo el proyecto: **cero resultados reales**. Las 4 coincidencias
que aparecieron en la búsqueda amplia son, sin excepción, datos de
prueba de OTRO dominio, sin ninguna relación con un programa de
afiliados de Alarfly: una línea de presupuesto de ejemplo llamada
"commission" en un test de FP&A (una comisión de VENTAS del negocio
de un cliente, no de Alarfly) y "Comisión bancaria" en fixtures de
conciliación de Tesorería (un cargo bancario del cliente, no un pago
de Alarfly a un afiliado).

### Determinación de necesidad real

**No existe ningún módulo, usuario afiliado, link, atribución, regla,
comisión ni dashboard de afiliados.** No existe tampoco la
precondición que lo haría útil: sin registro público (E1-E5) no hay
ninguna conversión real que un afiliado pudiera generar todavía.

Por instrucción explícita de esta etapa, **no se implementa de
ninguna forma**: ni el módulo, ni pagos, ni payout automático, ni
integración bancaria/cripto, ni infraestructura fiscal de afiliados —
ninguno de estos existe hoy y ninguno se construyó en este bloque.

### Arquitectura mínima necesaria (documentada, NO implementada)

Si se decide construirlo cuando exista registro/billing real:
- `AffiliateAccount` (1 por usuario, con su propio código/enlace —
  reutilizando el mismo mecanismo de atribución que E13, no uno
  aparte: un afiliado ES un referido con una regla de comisión
  encima, no un concepto sin relación).
- `AffiliateConversion` (referencia a la empresa que se convirtió en
  cliente de pago real — nunca antes de que exista un pago real, ver
  E8) + `commissionAmount` (fijo, $5 por el pedido comercial actual)
  + `commissionStatus` (`PENDING`/`APPROVED`/`PAID`, nunca pagado
  automáticamente sin revisión humana, para prevenir fraude/
  duplicación).
- El pago de la comisión en sí queda **fuera de alcance
  explícitamente** — es una operación de tesorería manual (un pago
  normal, como cualquier otro gasto), no una integración de payout.
- Reglas anti-fraude mínimas a definir antes de construir: un usuario
  no puede referirse a sí mismo (mismo correo/misma empresa), un
  referido no cuenta si se da de baja antes de N días.

### Sobre prueba social

No se creó ningún testimonio ni empresa ficticia — no se construyó
ninguna pieza de copy comercial en este bloque. Queda documentado como
regla para cuando se construya cualquier superficie comercial: **todo
ejemplo debe marcarse explícitamente como ejemplo/demo**, nunca
presentado como un cliente o testimonio real.

## 5. E15 — Growth Loops

### Mecanismos reales auditados (con evidencia, no supuestos)

| Mecanismo | ¿Genera un usuario/empresa NUEVA fuera de la empresa actual? | Evidencia |
|---|---|---|
| Invitar usuario (`access-levels.inviteUser`) | **No** — invita dentro de la MISMA empresa, respetando cupo por rol | Confirmado en el código y en F16-E1-E5 |
| Vistas guardadas compartibles (`core/saved-views`, "Compartir") | **No** — el enlace `?vista=<id>` solo funciona para alguien que YA tiene sesión en esa misma empresa (`ProtectedRoute` envuelve todo excepto `/acceso`) | Confirmado: cero rutas públicas fuera de `/acceso` |
| Anclar reportes (`core/pinned-items`) | No — mismo alcance, dentro de la empresa | — |
| Exportar PDF/Excel/CSV | No — el archivo exportado no contiene ningún enlace de vuelta a Alarfly ni mecanismo de atribución | Confirmado, son exportadores genéricos sin marca |
| Junta (mensajes internos) | No — exclusivamente dentro de la empresa | — |

### Hallazgo real y honesto

**Alarfly no tiene hoy ningún growth loop de producto (Product-Led
Growth) que cruce el límite de una empresa** — y esto es, en gran
parte, una CONSECUENCIA CORRECTA de su propio diseño de seguridad: el
aislamiento estricto por `companyId` (la regla de arquitectura más
defendida en todo el proyecto, F14) impide por construcción que una
acción de un usuario "se filtre" hacia afuera de su empresa sin que
alguien lo decida explícitamente. Lo único que hoy genera más
usuarios es la invitación de equipo — que es expansión de cuenta, no
adquisición de nuevos clientes.

### Clasificación pedida

- **Product-Led Growth**: no existe ningún mecanismo real hoy (todo lo
  compartible requiere sesión dentro de la misma empresa).
- **Sales-Led Growth**: no aplica — no hay ningún proceso de venta ni
  vendedor en el sistema.
- **Affiliate Growth**: no existe (E14).
- **Content Growth**: no existe — no hay landing, blog ni contenido
  público (E1-E5).
- **Referral Growth**: no existe (E13).

**No se asume que Alarfly deba usar los 5** — la recomendación (ver
abajo) es priorizar Referral Growth sobre Affiliate Growth como primer
paso, porque un referido simple (invitar a un colega dueño de otro
negocio) no requiere resolver pagos de comisión, mientras que
Affiliate sí.

## 6. Auditoría Transversal (E11–E15)

- **Seguridad**: no se construyó ningún endpoint nuevo en este
  bloque — no hay superficie nueva que auditar. Reconfirmado (sin
  cambios, ya validado extensamente en F14) que ningún endpoint del
  proyecto acepta `companyId` como parámetro de URL ni confía en un
  `companyId` del body/frontend para autorizar una operación.
- **RBAC / UserCompanyAccess**: sin cambios — no se tocó ningún rol ni
  permiso.
- **Multiempresa**: reconfirmado el aislamiento (ver E15 arriba) —
  ningún mecanismo existente permite que una acción de una empresa
  afecte a otra sin pasar por `UserCompanyAccess` (F14-E3).
- **Auditoría**: no se creó ningún sistema nuevo — se confirmó que
  `core/audit` es la única fuente de eventos con actor humano, y se
  documentó (E11) que la creación de empresa por seed no genera
  auditoría porque no tiene actor (comportamiento esperado, no un
  bug).
- **Source of Truth**: mapeado explícitamente en la tabla de E11 —
  ninguna métrica tiene dos fuentes que puedan desincronizarse, porque
  no se construyó ninguna métrica nueva que pudiera duplicar una
  existente.

## 7. Qué se implementó

**Nada.** Cero cambios de código en este bloque — ni backend ni
frontend. Es la conclusión correcta según la evidencia: no existe
ningún problema real (CRITICAL/HIGH/MEDIUM) que justifique tocar
código, y las 5 etapas coinciden en la misma precondición bloqueante
(ausencia de registro público/trial/billing, ya documentada y fuera de
alcance desde E1-E5/E8). Construir cualquier pieza de E12/E13/E14 hoy
sería, por definición, infraestructura especulativa — exactamente lo
que este bloque prohíbe explícitamente en más de un lugar.

## 8. Qué se descartó y por qué

- **Panel de métricas comerciales cruzando empresas (E11)**: descartado
  por ahora — cruza el límite de aislamiento multiempresa a propósito,
  es una decisión de producto (¿quién puede verlo? ¿nuevo rol
  `PLATFORM_ADMIN`?) que no corresponde tomar unilateralmente en un
  bloque de auditoría.
- **Cualquier pieza de A/B testing (E12)**: descartada — no hay
  volumen ni flujo público que experimentar.
- **Cualquier pieza de referidos (E13)**: descartada — no hay registro
  público donde atribuir un referido.
- **Cualquier pieza de afiliados (E14)**: descartada explícitamente por
  instrucción del bloque, y porque depende de E13 + billing real (E8).
- **Cualquier growth loop artificial (E15)**: descartado — no se forzó
  ningún mecanismo de compartir/viralidad que el producto no tenga de
  forma natural.

## 9. Deuda documentada (nueva de este bloque)

1. Sin panel de métricas comerciales de la plataforma (E11) — depende
   de una decisión de rol/acceso nueva.
2. Sin infraestructura de experimentación (E12) — depende de volumen
   real, que depende de E1-E5/E8.
3. Sin sistema de referidos (E13) — depende de registro público
   (E1-E5).
4. Sin programa de afiliados (E14) — depende de E13 + billing (E8).
5. Sin ningún growth loop de producto que cruce empresas (E15) — es
   consecuencia correcta del aislamiento multiempresa, no un defecto a
   corregir por sí solo.

Toda esta deuda es una repetición, desde ángulos distintos, de la
misma raíz ya documentada en E1-E5/E8: sin registro público ni
billing real, casi ninguna pieza de Growth clásico tiene algo que
medir o de qué crecer todavía.

## 10. Riesgos residuales

- Ninguno nuevo de seguridad/RBAC/multiempresa (no se tocó código).
- Riesgo de producto (no técnico): construir cualquiera de estas
  piezas ANTES de tener registro público/trial/billing produciría
  infraestructura sin uso real — el mismo riesgo que este bloque
  evitó deliberadamente al no implementar nada.

## 11. Recomendación de secuencia futura

Dado que las 5 etapas comparten la misma precondición, el orden lógico
para desbloquearlas no es E12→E13→E14 por número, sino por
dependencia real:

```
1. Registro público + creación de empresa (E1-E5, ya documentado)
2. Trial + billing real (E8, ya documentado)
3. E11 (panel de métricas comerciales) — ya hay algo real que medir
4. E13 (referidos simples) — más barato que afiliados, sin pagos
5. E14 (afiliados) — reutiliza la atribución de E13 + billing de (2)
6. E12 (A/B testing) — solo si el volumen de (1) lo justifica
```
