# F16_ACTIVATION_CONVERSION_AUDIT.md — Onboarding, Activación, Conversión y Retención Inicial (E6–E10)

> Fuente de verdad: el informe final de `F16` Bloque 1 (E1–E5) —
> `F16_COMMERCIAL_FOUNDATION_AUDIT.md` y `F16_COMMERCIAL_FUNNEL_AUDIT.md`.
> Este documento no repite esa auditoría; solo referencia sus
> conclusiones donde una etapa de E6–E10 depende de ellas (sobre todo
> E8, que depende directamente de la ausencia de trial/billing ya
> confirmada en E1–E5).

## 1. E6 — Onboarding

### Recorrido real hoy

```
REGISTRO            → NO EXISTE (confirmado en E1-E5, sin cambios)
    ↓
CREACIÓN DE EMPRESA  → Solo por seed/soporte (sin cambios en este bloque)
    ↓
PRIMER LOGIN         → LoginPage → Dashboard ("Hola, {nombre}")
    ↓
CONFIGURACIÓN        → SetupProgressBar (4 pasos, ya existía)
    ↓
PRIMERA ACCIÓN        → El usuario debe adivinar en qué pantalla completar cada paso
```

`core/account/services/setup-status.service.js` ya existía y es
exactamente el mecanismo reutilizable que pedía auditar esta etapa —
**no se creó un segundo sistema**. Calcula 4 pasos leyendo el estado
real del sistema (nunca un botón de "marcar como hecho"): datos
fiscales (RIF), primera cuenta bancaria, primer producto o cliente
(según `Company.usesInventory`), primer usuario invitado.
`frontend/src/components/SetupProgressBar.jsx` ya lo consume en el
Panel principal, con actualización automática cada 20s y "Descartar"
por sesión.

### Fricción real encontrada (evidencia)

Cada paso de `SetupProgressBar` mostraba su `label`/`description` en
texto plano ("Guarda el RIF o NIT de tu empresa en el Perfil de la
Empresa (Mi Cuenta)"), **sin ningún enlace a esa pantalla** — el
usuario tenía que leer el texto, entender a qué módulo se refiere
("Mi Cuenta", "Tesorería", "Inventario", "Niveles de Acceso") y
navegar ahí por su cuenta usando el menú lateral. Confirmado leyendo
el componente entero: no había `useNavigate`/`Link` en el archivo.

**Corregido** (fix mínimo, reutilizando datos que el propio backend
ya calculaba): `setup-status.service.js` ahora agrega `path` a cada
paso (`/mi-cuenta/perfil`, `/tesoreria/cuentas`,
`/inventario/catalogo` o `/cuentas/clientes` según corresponda,
`/niveles-de-acceso`) y `SetupProgressBar.jsx` agrega un botón "Ir →"
por paso pendiente que navega directo con `useNavigate`. No se creó
ningún componente ni pantalla nueva.

### Respuestas a las preguntas pedidas

1. **¿Qué debe hacer obligatoriamente un usuario nuevo?** Nada es
   técnicamente obligatorio para poder usar la app — el sistema no
   bloquea ninguna pantalla mientras el checklist esté incompleto. Los
   4 pasos son una guía, no una puerta.
2. **¿Qué puede configurarse después?** Los 4 pasos, en cualquier
   orden y en cualquier momento — el checklist no impone secuencia.
3. **¿Qué configuración puede tener defaults?** `Company.usesInventory`
   ya tiene default `true`; `Company.fiscalYearStartMonth` default
   enero; `Company.dueDateWarningThresholdDays` default 7 — los 3 ya
   existían de piezas anteriores, ninguno bloquea el primer valor.
4. **¿Qué configuración bloquea el primer valor?** Ninguna de las 4
   del checklist bloquea — pero SÍ hay un bloqueo real de negocio
   distinto y correcto: `Venta Rápida` rechaza una venta sin cliente
   si no existe "Consumidor Final" configurado (validado en vivo
   durante esta auditoría, ver E7). No es fricción de onboarding, es
   una regla financiera legítima (toda venta necesita un cliente para
   la Cuenta por Cobrar).
5. **¿Cuántos pasos reales existen?** 4 (fiscal, banco, producto/
   cliente, invitar usuario) — ya evidenciados con `curl`/código, sin
   cambios en este bloque.
6. **¿Dónde puede abandonar?** El punto de mayor abandono estructural
   es anterior a todo esto: no hay registro público (E1-E5) — el
   abandono real ocurre antes de que el checklist exista.
7. **¿Qué puede automatizarse sin riesgo?** El paso "primer usuario
   invitado" no puede automatizarse (siempre requiere una decisión
   humana de a quién invitar); los otros 3 tampoco se prestan a
   piloto-automático sin arriesgar datos incorrectos (RIF, banco y
   catálogo son datos reales de la empresa).

### Onboarding ideal (conceptual, NO implementado)

El flujo "Vamos a configurar lo esencial" en un solo wizard guiado
(modal o pantalla dedicada, paso a paso, con "Siguiente"/"Omitir por
ahora") **no existe** — se confirmó que no hay ningún componente ni
ruta de bienvenida (`grep -rni "bienvenid"` en todo `frontend/src`:
cero resultados). Hoy el "onboarding" es enteramente pasivo (una
barra en el Dashboard que el usuario puede ignorar). Construir un
wizard activo es una decisión de producto/diseño de mayor alcance
(¿modal al primer login? ¿pantalla dedicada? ¿cuántos pasos se
pueden omitir?) — se documenta como **DEBT** y **PENDIENTE DE
DECISIÓN DEL USUARIO**, no se improvisa un diseño nuevo sin esa
decisión.

## 2. E7 — Activación / First Value

### Candidato a First Value: evidencia, no suposición

Se auditó el Dashboard (`DashboardPage.jsx`) completo — que resultó
ser mucho más rico de lo que documentaba la última entrada de
`CLAUDE.md` (evolucionó en fases posteriores, F9 "Centro Operativo" y
F12 "Centro Operativo Inteligente", con 4 capas: Estado general →
Requiere tu atención → Acciones rápidas → Evolución del negocio) y
`Finanzas > Resumen` (`ResumenPage`, con las preguntas "¿Cuánto dinero
tengo?"/"¿Cuánto me deben?"/"¿Cuánto debo?" en lenguaje llano).

**No se asumió "crear una cuenta" como primer valor.** Se identificaron
dos candidatos reales, cada uno con evidencia de código:

- **Candidato A — Acción rápida (Venta Rápida)**: registrar la primera
  venta en `/ventas/rapida` es la acción más corta y frecuente
  disponible (formulario de una sola pantalla, sin navegación extra).
  Verificado en vivo con Playwright contra Postgres real: una venta de
  10,00 US$ completa (con cliente, producto, cobro) tomó menos de 10
  interacciones de formulario y generó automáticamente factura +
  asiento contable + cobro — sin que el usuario tuviera que saber nada
  de contabilidad.
- **Candidato B — Resumen financiero**: `/finanzas/resumen` responde
  en lenguaje simple las 6 preguntas que de verdad le importan a un
  dueño de negocio sin conocimientos contables (dinero disponible,
  cuánto le deben, cuánto debe, previsión de cobro/pago a 8 semanas) —
  es la traducción más directa posible de "entender su valor
  financiero" que tiene hoy el producto.

### Distinción First Action vs. First Value (evidencia real del gap)

Se confirmó en código y en vivo que el producto **ya distinguía**
ambos conceptos en la superficie (el toast/mensaje de éxito de Venta
Rápida decía "Factura N.º X registrada... cobrada por Y.") pero **no
conectaba la acción con el valor**: no había ningún enlace desde ese
mensaje de éxito hacia una pantalla que mostrara el impacto financiero
real. Un usuario podía registrar su primera venta y no tener ninguna
invitación a ver "y esto qué significa para tu caja" — exactamente el
ejemplo que da el propio prompt de esta etapa ("Registrar una venta =
acción. Comprender cuánto vendió, cuánto ganó y cómo afecta su caja =
valor.").

**Corregido** (fix mínimo, ninguna pantalla ni cálculo nuevo): el
mensaje de éxito de `QuickSalePage.jsx` ahora incluye un enlace "Ver
cómo afectó tu situación financiera →" hacia `/finanzas/resumen`
(reutilizando la pantalla ya construida en F5). Validado en vivo de
punta a punta con Playwright + Postgres real: venta registrada →
mensaje con el enlace → clic → navegación exitosa a
`/finanzas/resumen`, que carga con datos reales de la empresa.

### Activation Event — definición propuesta (con evidencia)

**No existe hoy ningún Activation Score ni indicador numérico de
activación** más allá del contador simple de `setup-status.service`
(`completedCount`/`totalCount`, 0 a 4) — confirmado por `grep`, no hay
ninguna tabla ni cálculo de "score" en todo el backend. Se documenta
como ausente, **no se construye un sistema de scoring nuevo** (el
prompt lo pide explícitamente: "No construir todavía un sistema
complejo de scoring").

Definición recomendada, basada en evidencia real del propio sistema
(no inventada):

> **Un usuario está activado cuando completó al menos 1 de los 4 pasos
> de `setup-status.service` Y registró al menos 1 movimiento de dinero
> real** (una venta, un cobro, un gasto o un asiento). El primero
> confirma que confió un dato real de su negocio a Alarfly; el segundo
> confirma que ya generó valor financiero real, no solo configuración.

Esta definición reutiliza dos fuentes que YA existen
(`setup-status.service` + cualquier tabla con `companyId`/fecha de
creación real, ej. `ArInvoice`/`JournalEntry`) — no requiere ningún
campo ni tabla nueva para calcularse si se decide construir el
indicador más adelante.

## 3. E8 — Conversión Trial → Paid

**Sin cambios de código — nada que corregir, porque no hay nada
construido que auditar más allá de lo ya confirmado en E1–E5.**
Reconfirmado con `grep` sobre todo el proyecto (schema + `src/` +
`frontend/src/`) los 12 términos pedidos por esta etapa
(`trial`/`trialStart`/`trialEnd`/`subscription`/`plan`/`billing`/
`payment`/`expiration`/`cancellation`/`upgrade`/`downgrade`): **cero
coincidencias relacionadas con facturación comercial** (los únicos
`payment`/`plan` que existen son `ArPayment`/`ApPayment`/`PaymentOrder`
— pagos de clientes/proveedores del propio negocio del usuario, y
`Budget`/`AnalysisAutomationConfig` — planes financieros/de
automatización, conceptos de negocio del cliente, no del modelo
comercial de Alarfly).

### Qué ocurre hoy en cada punto pedido

| Momento | Estado actual |
|---|---|
| Empieza el trial | No existe el concepto — cualquier usuario invitado tiene acceso indefinido |
| Pasa 1 día / varios días / quedan pocos | No se cuenta ningún día, no hay ningún aviso |
| Termina el trial | No hay ningún bloqueo — nada expira nunca |
| Usuario quiere continuar | No hay ningún flujo de "continuar" porque nunca hubo límite |
| Usuario no paga | No aplica — nunca se le pidió pagar |
| Usuario cancela | No hay ningún concepto de cancelación de cuenta comercial (sí existe, sin relación, la "solicitud de baja de cuenta" de un usuario individual dentro de una empresa — Mi Cuenta, otro concepto distinto) |

### Comunicación

El producto **no puede informar** cuánto tiempo de prueba queda, qué
incluye el plan, ni qué pasa al finalizar — no existe ningún dato del
que leer esa información. No se simuló ni se inventó ningún contador,
siguiendo la regla explícita del prompt contra dark patterns.

### Pricing — decisión preservada sin alterar

$25/mes, 7 días gratis, un solo plan — **igual que se dejó en E1-E5,
sin ningún cambio.**

### Arquitectura necesaria (conceptual, NO implementada)

Para que el recorrido Trial→Paid exista de verdad se necesitaría, como
mínimo (documentado, no construido):
- `Company.trialStartedAt`/`Company.trialEndsAt` (mismo patrón ya
  usado para otros campos de configuración de empresa,
  ej. `dueDateWarningThresholdDays`).
- Un modelo de plan/suscripción con estado (`ACTIVE`/`PAST_DUE`/
  `CANCELLED`) y su relación a `Company`.
- Un proveedor de pago real (pasarela) — decisión que el prompt
  reserva explícitamente al usuario.
- Un middleware que, sin tocar `requireAuth`/RBAC existentes, verifique
  el estado del plan antes de servir rutas de negocio (nunca en el
  frontend — la superioridad del servidor sobre trial/plan/pago es un
  requisito explícito de esta misma etapa).

Ninguna de estas piezas se construyó — es exactamente lo que el
prompt prohíbe adelantar ("No implementar billing automáticamente").

## 4. E9 — Retención inicial

### Mecanismos reales de recurrencia (ya existentes, reutilizados sin duplicar)

- **`core/alerts`** (motor genérico ya usado por Tesorería/Fiscal/
  Inventario/AR/Análisis Avanzados): 9 tipos de alerta reales (saldo
  bajo, tarjeta cerca del límite, pago por vencer, obligación fiscal
  por vencer, stock bajo, producto por vencer, cliente con atraso
  recurrente, cuenta bancaria desconectada, alerta de Análisis
  Avanzados) — la señal de recurrencia más fuerte que tiene el
  producto hoy: cambia todos los días con datos reales del negocio.
- **`NotificationCenter`** (campana en la barra superior, visible en
  toda la app): recarga cada 60 segundos mientras la sesión está
  abierta — confirma que la recurrencia hoy es **dentro de la sesión
  activa**, nunca fuera de ella.
- **Previsión de Liquidez** (8 semanas, Tesorería/Finanzas): cambia
  semana a semana con AR/AP/deuda reales — frecuencia semanal natural,
  no inventada.
- **KPIs/Presupuesto vs. Real/Análisis Avanzados**: cambian a ritmo
  mensual — frecuencia mensual natural (cierre de mes, revisión de
  desviaciones).

### Hallazgo real: no hay ningún "pull" fuera de la app

Confirmado (reconfirmación directa de una decisión ya documentada, sin
cambios): `core/alerts/alerts.service.js` mantiene
`notifyAlert(alert)` como función vacía —
**el envío por correo/push sigue sin implementar**, tal como está
documentado desde hace varias fases. Esto significa que **toda la
recurrencia depende hoy de que el usuario decida abrir la app por su
cuenta** — no hay ningún mecanismo que lo traiga de vuelta si no abre
la pestaña. Es el hallazgo más importante de esta etapa.

### Retention Event propuesto (evidencia, no inventado)

> **"Volver porque hay una decisión financiera pendiente"** — no
> "volver porque toca hacer login". El candidato más fuerte, con
> evidencia real, es la alerta `AR_COLLECTION_ESCALATION`/
> `PAYMENT_DUE_SOON`/`CUSTOMER_RECURRING_LATE_PAYMENT`: cada una
> representa una decisión real de dinero que solo el dueño del negocio
> puede tomar (cobrar, pagar, bloquear un cliente). No se propone una
> frecuencia artificial ("recuérdale todos los días") — la frecuencia
> real ya la determina cuándo vence cada documento real de la empresa.

### F12 (Centro Operativo Inteligente) — reutilizado, no duplicado

`InsightCard` en el Dashboard (ya construido en F12) ya combina alerta
+ evidencia + recomendación cuantificada (ej. previsión de liquidez,
cobranza) — es el mecanismo de "inteligencia" más cercano a lo que
esta etapa pedía no reconstruir. Confirmado que sigue siendo el único
motor de este tipo; no se creó ningún motor nuevo.

## 5. E10 — UX Comercial Transversal

### Continuidad de marca (verificado contra el código real, no contra `CLAUDE.md`)

El propio `frontend/src/styles/theme.css` confirma en vivo la paleta
pedida por esta etapa — **wine red + charcoal/graphite**, dark-first:
`--color-brand: #9c2740` (vino), `--color-bg: #0b0d10` (grafito casi
negro, nunca negro puro). Esto es más reciente que la última entrada
del "Sistema de Diseño" documentada en la bitácora de `CLAUDE.md`
(que describía "Sello dorado") — el sistema de diseño evolucionó en
una fase posterior no reflejada en esa entrada; **no hay ninguna
inconsistencia real que resolver hoy**, solo una desactualización de
la bitácora que queda anotada para una futura sesión de mantenimiento
de `CLAUDE.md` (fuera de alcance de este bloque, que es de Growth, no
de UX/Design System).

No existe hoy ninguna landing pública (E1-E5), así que el riesgo
explícito que pide auditar esta etapa ("marketing por un lado +
software diferente por otro") **no puede materializarse todavía** —
se documenta como un requisito a cumplir el día que se construya la
landing (usar exactamente estos tokens, sin un segundo sistema de
diseño para Growth), no como un hallazgo de hoy.

### Estados vacíos (EmptyState) — auditoría real de las ~40+ pantallas que lo usan

`core/ui/EmptyState.jsx` ya soporta las 3 partes pedidas por esta
etapa (mensaje + acción opcional con `actionLabel`/`onAction`) — el
componente en sí no tenía ningún defecto. El hallazgo real está en el
**contenido**: se muestreó el uso real en más de 20 pantallas
(`grep` de `EmptyState` en `frontend/src/pages`) y la gran mayoría solo
dice qué falta ("Todavía no creaste ningún KPI personalizado.") sin
explicar por qué importa ni ofrecer una acción directa — la prop
`actionLabel`/`onAction` **nunca se había usado en ninguna pantalla
de todo el proyecto** (confirmado con `grep`, cero resultados).

**Decisión: corregir solo los 2 estados vacíos que están en la ruta
crítica de onboarding/primer valor, documentar el resto como deuda.**
Reescribir las ~40 pantallas restantes es un trabajo de contenido a
nivel de toda la aplicación, desproporcionado para un bloque de
auditoría (y la mayoría son pantallas de configuración avanzada —
FP&A, Fiscal, Períodos — que un usuario nuevo no visita antes de
activarse). Se corrigieron, con la MISMA capacidad que el componente
ya tenía sin usar:

- `CustomersPage.jsx` ("Todavía no registraste ningún cliente — sin
  al menos uno, no puedes emitir una factura de venta." + botón
  "+ Nuevo cliente").
- `CatalogPage.jsx` ("Todavía no creaste ningún producto — sin al
  menos uno, no puedes registrar una venta ni controlar tu stock." +
  botón "+ Nuevo producto").

Ambas son, literalmente, el destino del paso 3 del checklist de
onboarding (`setup-status.service`) — la fricción más cara de
resolver era la más barata de corregir, porque el componente ya la
soportaba.

### Errores

El manejador central de errores (`core/middlewares/errorHandler.js`,
ya auditado y reforzado en F15) sigue traduciendo los errores técnicos
a mensajes claros en toda la API — reconfirmado sin cambios en este
bloque. El error real de negocio visto en vivo durante esta auditoría
("Esta venta necesita un cliente: no hay 'Consumidor Final'
configurado. Indica un cliente o configúralo en Ajustes de CxC.") es
un ejemplo real y correcto del estándar que pide esta etapa: claro,
específico, y dice qué hacer — no se tocó, ya cumplía.

### Ayuda contextual, glosario, tooltips

`HelpTooltip`/`GlossaryTerm`/el botón de ayuda contextual (`core/help`)
ya existen y están aplicados de forma amplia en todo el proyecto —
reconfirmado sin cambios, consistente con el resto de la auditoría.

## 6. Funnel actualizado (resultado de E6-E10)

```
VISITA           → NO EXISTE (sin cambios, ver E1-E5)
REGISTRO         → NO EXISTE (sin cambios, ver E1-E5)
PRIMER LOGIN     → Existe, sin cambios de comportamiento
CONFIGURACIÓN    → Existe — MEJORADO: cada paso ahora navega directo (antes solo texto)
PRIMERA ACCIÓN   → Existe (Venta Rápida, Acciones rápidas del Dashboard)
PRIMER VALOR     → MEJORADO: la primera venta ahora enlaza directo al Resumen financiero
ACTIVACIÓN       → Definición propuesta (ver E7), no implementada como indicador visible
TRIAL            → NO EXISTE (sin cambios, ver E1-E5/E8)
CONVERSIÓN       → NO EXISTE (sin cambios, ver E1-E5/E8)
RETENCIÓN        → Existe (core/alerts, dentro de la sesión) — sin "pull" fuera de la app (email/push no implementado)
```

## 7. Activación — resumen ejecutivo

- **Definido** (documentado en E7, no implementado como score): 1 paso
  de configuración + 1 movimiento de dinero real.
- **No implementado**: ningún indicador visible de "% activado" ni
  cohortes de activación — deuda documentada, no construida sin caso
  de uso real detrás (mismo criterio de toda la sesión: no construir
  infraestructura especulativa).

## 8. Fricciones encontradas (con severidad)

| # | Fricción | Etapa | Severidad | Estado |
|---|---|---|---|---|
| 1 | Pasos del checklist de onboarding sin enlace directo a la pantalla | E6 | MEDIUM | **Corregido** |
| 2 | Primera venta sin enlace al impacto financiero (First Action ≠ First Value) | E7 | MEDIUM | **Corregido** |
| 3 | Estados vacíos de Clientes/Productos sin explicación ni acción (destino literal del onboarding) | E6/E10 | MEDIUM | **Corregido** |
| 4 | Sin onboarding activo/guiado (wizard) — todo es pasivo | E6 | LOW/DEBT | Documentado, no implementado (decisión de producto) |
| 5 | Sin Activation Score visible | E7 | DEBT | Documentado, definición propuesta |
| 6 | Sin trial/billing real | E8 | DEBT | Ya documentado en E1-E5, reconfirmado |
| 7 | Retención depende 100% de que el usuario abra la app (sin email/push) | E9 | DEBT | Documentado, punto de extensión ya existente y vacío |
| 8 | ~40 estados vacíos de pantallas no críticas sin explicación/acción | E10 | LOW/DEBT | Documentado, corrección desproporcionada para este bloque |

**No hay ningún hallazgo CRITICAL ni HIGH.** Los 3 MEDIUM se
corrigieron (regla de cierre del bloque). El resto es DEBT/LOW
documentado, ninguno bloqueante.

## 9. Oportunidades futuras (no implementar todavía)

- Onboarding activo (wizard/modal) al primer login, con opción de
  omitir cada paso — requiere que el usuario decida la forma exacta.
- Activation Score real (cohortes, % activado por semana) reutilizando
  `setup-status.service` + primer movimiento real, sin tabla nueva más
  que un `AuditLog` ya existente que se puede consultar por fecha.
- Conectar `core/alerts.notifyAlert()` a un proveedor de correo/push
  real — el punto de extensión ya existe, vacío, desde hace varias
  fases; solo falta elegir proveedor (decisión del usuario).
- Extender el patrón `actionLabel`/`onAction` de `EmptyState` al resto
  de pantallas, priorizando las que un usuario nuevo visita primero.

## 10. Deuda

1. Sin registro público / creación de empresa fuera del seed (E1-E5,
   reconfirmado, sin cambios).
2. Sin trial real (campos, lógica de vencimiento) (E8).
3. Sin modelo de plan/suscripción/pago (E8).
4. Sin onboarding activo guiado (E6).
5. Sin Activation Score visible (E7).
6. Sin envío de alertas por correo/push — retención limitada a la
   sesión activa (E9).
7. ~40 estados vacíos de pantallas secundarias sin explicación/acción
   (E10) — deuda de contenido, no de código.
8. `CLAUDE.md` desactualizado respecto al Sistema de Diseño real
   (describe "Sello dorado", el código ya usa wine red/charcoal) —
   deuda de documentación, fuera de alcance de este bloque de Growth.

## 11. Recomendaciones

Ver también la sección "Decisiones" del informe final de este bloque
más abajo, con el mismo formato de las 3 categorías pedidas
(DECISIÓN ACTUAL / RECOMENDACIÓN / PENDIENTE DE DECISIÓN DEL USUARIO).
