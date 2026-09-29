# F16_COMMERCIAL_FOUNDATION_AUDIT.md — Fundamentos Comerciales (E1-E5)

> **Nota de fuente**: se buscó el archivo `Markdown.md` (Cuestionario
> Maestro de Landing Page) en todo el repositorio y el sistema de
> archivos de esta sesión — **no se encontró**. Este documento usa
> como fuente de verdad el resumen de ese cuestionario que el propio
> usuario incluyó directamente en el pedido de esta fase. Si el
> archivo real existe aparte, compartirlo permitiría revisar cualquier
> matiz que el resumen no haya capturado.

## E1 — Auditoría del Sistema Comercial Actual

| Capacidad | Existe | Ubicación | Estado | Usuario real hoy | Fuente |
|---|---|---|---|---|---|
| Registro público (signup) | **No** | — | AUSENTE | Nadie puede crear cuenta sin ser invitado | Búsqueda exhaustiva, 0 rutas de signup |
| Login | Sí | `core/auth` | EXISTENTE Y CORRECTA | Sí, ya con 2FA, bloqueo de fuerza bruta (F15-E3), revocación de sesión (F15-E2) | — |
| Recuperación de contraseña | **No** | — | AUSENTE | — | Ya documentado desde F15-E2 (bloqueado por falta de envío real de correo) |
| Creación de empresa | **No** (fuera del seed) | `prisma/seed.js` únicamente | AUSENTE | Solo existen las empresas ya sembradas/creadas manualmente | Búsqueda exhaustiva, `prisma.company.create` solo en seed/tests |
| Invitación a una empresa existente | Sí | `access-levels/services/users.service.js` | EXISTENTE Y CORRECTA | Sí, con cupo por rol y auditoría | — |
| Aceptar invitación | Sí | `core/auth.acceptInvitation` | EXISTENTE Y CORRECTA | Sí | — |
| Trial / prueba gratis | **No** | — | AUSENTE | — | 0 campos `trial*` en todo el schema |
| Pricing / Planes | **No** | — | AUSENTE | — | 0 modelos de plan/precio en el schema |
| Billing / cobro | **No** | — | AUSENTE | — | 0 integración de pasarela de pago |
| Suscripción | **No** | — | AUSENTE | — | 0 modelo `Subscription` |
| Límites por rol (cupos) | Sí, pero de acceso, no comerciales | `core/rbac/roles.js` (`ROLE_QUOTAS`) | EXISTENTE PERO NO ES UN LÍMITE COMERCIAL | Ya activo (ADMIN sin límite, Contador 3, Financiero 4, Colaborador 8) | Fijo en código, no ligado a ningún plan pagado |
| Onboarding / configuración inicial | Sí | `core/account/services/setup-status.service.js` + `SetupProgressBar` (frontend) | EXISTENTE Y CORRECTA | Sí, 4 pasos verificados contra datos reales | — |
| Señal de "primer valor" | Parcial | Mismo `setup-status` | EXISTENTE PERO INCOMPLETA | Cubre 4 hitos, no todos los posibles | — |
| Analítica de comportamiento (tracking de uso) | **No** | — | AUSENTE | — | Sin Google Analytics/PostHog/Segment/evento propio, confirmado |
| Página pública / landing | **No** | — | AUSENTE | Cualquier visitante sin sesión solo ve `/acceso` (login) | `frontend/src/App.jsx`, sin ninguna ruta pública fuera de `/acceso` |
| SEO / metadata pública | **No** | — | AUSENTE | — | Sin landing, no aplica todavía |
| Multiempresa (relevante para "un cliente, varias empresas") | Sí | F14 completo | EXISTENTE Y CORRECTA | Sí | — |
| Multimoneda (Bs/USD/EUR) | Sí | `core/fx` | EXISTENTE Y CORRECTA | Sí, ya usado en AR/AP/Consolidación | — |

**Conclusión de E1**: el sistema comercial de adquisición
(landing→registro→trial→pago) **no existe en absoluto** — lo que
existe es un producto financiero multiempresa completo y ya probado,
pero accesible únicamente por invitación a una empresa ya creada a
mano. No se encontró ningún bug crítico/alto que corregir en este
punto (la ausencia de estas capacidades es un gap de alcance, no un
error de código).

## E2 — Landing / Posicionamiento

### Producto real que sí puede mostrarse hoy

Contabilidad completa (plan de cuentas, asientos, reportes,
periodos), Tesorería (8 grupos: cuentas/caja, conciliación, tarjetas,
órdenes de pago, deuda, caja chica, alertas, previsión de liquidez),
Cuentas por Cobrar y Pagar (con límite de crédito, cobranza
escalonada, notas de crédito), Inventario (multi-almacén,
FIFO/LIFO/PMP, trazabilidad de lotes), Fiscal (impuestos, facturación
electrónica MOCK, calendario fiscal), FP&A (presupuestos,
desviaciones, What-If, KPIs), Reportes (estados financieros
consolidados, flujo de efectivo, rentabilidad, antigüedad de saldos,
dashboard ejecutivo), Análisis Avanzados (16 tipos de análisis
financiero automatizados y auditados), multiempresa con consolidación
segura, Centro de Notificaciones, Niveles de Acceso con 4 roles, Mi
Cuenta con 2FA real. Todo esto **ya funciona y ya se probó** — es
material real y honesto para una landing.

### Mensaje: comparación cuestionario vs. realidad

| Mensaje del cuestionario | Evaluación |
|---|---|
| "Simplifica la gestión financiera de las empresas" | ✅ Correcto y demostrable — 8 módulos reales |
| "Mejora el control de las finanzas mediante métodos inteligentes" | ⚠️ Defendible SI "inteligente" se refiere a automatización real (16 análisis automáticos, motor de alertas, KPIs) — **nunca** debe leerse como IA/aprendizaje automático, que no existe |
| "Mejora las finanzas sin ser un experto en finanzas" | ✅ Correcto — HelpTooltip, glosario en español simple, y el propio sistema de diseño se construyeron explícitamente para esto |
| "Programa inteligente y autónomo capaz de aprender de la conducta de la empresa" | 🔴 **NO se puede afirmar como capacidad actual** — F12-C (integración real de IA) está explícitamente pospuesta, nunca se construyó. Esto es visión futura, no un hecho de hoy. Presentarlo en presente sería una promesa falsa. |
| "Trabaja con Bs, USD y EUR" | ✅ Correcto y demostrable |
| "Multiempresa" | ✅ Correcto y demostrable (F14) |
| Conceptos: Control/Claridad/Rentabilidad/Automatización/Decisiones/Velocidad/Crecimiento/Inteligencia empresarial | ✅ Cada uno tiene una capacidad real detrás (control=RBAC+bloqueo de periodo; claridad=glosario+UI simple; automatización=9 cron jobs+alertas; decisiones=FP&A/KPIs; velocidad=Venta Rápida/autocompletado; inteligencia empresarial=Análisis Avanzados) |
| Concepto: "Integración" | ⚠️ Riesgo de ambigüedad — si se lee como "se conecta con tu banco/SII", es falso (F13 confirmó 0 integraciones externas reales); si se lee como "todos tus módulos financieros en un solo lugar", es correcto |
| "Crecimiento" / "busca escalar" | ✅ Defendible como intención de producto (F15 preparó la base técnica); no hay clientes reales todavía que lo demuestren en la práctica |

### Posicionamiento

- **Problema que resuelve**: gestión financiera dispersa/manual
  (hojas de cálculo, procesos separados) en pymes que no tienen un
  experto en finanzas de tiempo completo.
- **Cliente ideal según el cuestionario**: dueños de pyme sin
  formación financiera formal, que quieren control sin volverse
  contadores.
- **Quién puede usar el producto real hoy**: exactamente ese perfil —
  el sistema de diseño, el lenguaje simple y el glosario contextual ya
  se construyeron pensando en un usuario sin conocimientos técnicos
  (documentado explícitamente en `CLAUDE.md` desde el inicio del
  proyecto).
- **Propuesta de valor**: "control financiero real, sin ser experto" —
  ya sostenible con el producto actual.
- **Diferencia demostrable hoy**: automatización real (alertas,
  análisis, KPIs) + multiempresa + multimoneda — no "IA".

### Estructura de landing propuesta por el usuario (Hero/Solución/Finanzas/Control/CTA/Precio/Testimonios)

**Suficiente para un primer lanzamiento**, con dos matices:
1. **"Testimonios"** no tiene contenido real todavía — sin clientes
   pagos, cualquier testimonio sería inventado. Sugerencia (no
   decisión): reemplazar por una sección de "qué incluye" o dejarla
   vacía hasta tener clientes reales, en vez de fabricar contenido.
2. Falta un tramo explícito para **"Registro"** dentro de esa
   estructura — la landing sola no resuelve el problema de E1 (no
   existe registro público); la estructura de la página y la
   construcción del signup real son dos cosas distintas, ambas
   necesarias.

## E3 — Pricing

**Decisión actual del cuestionario** (preservada, no modificada):
$25/mes, 7 días de prueba gratis, un solo plan, sin costo adicional.

### Respuestas al checklist técnico

1. ¿Existe subscription model? **No.**
2. ¿Existe billing? **No.**
3. ¿Existe payment provider? **No.**
4. ¿Existe trial state? **No** (0 campos en el schema).
5. ¿Existe expiration? **No.**
6. ¿Existe bloqueo al finalizar trial? **No.**
7. ¿Existe mecanismo de upgrade? No aplica todavía (un solo plan) —
   pero tampoco existiría la infraestructura para ofrecer uno
   distinto si se decidiera más adelante.
8. ¿Existe cancelación? **No.**
9. ¿Existe límite comercial (usuarios/empresas/documentos por plan)?
   **No** — lo único parecido son los cupos de `ROLE_QUOTAS`
   (Contador 3, Financiero 4, Colaborador 8), pero son **cupos de
   control de acceso fijos en código**, no límites de un plan
   comercial — hoy son iguales para cualquier empresa, pagada o no,
   porque no existe el concepto de "empresa pagada".
10. ¿Qué depende del deployment? El proveedor de pagos (Stripe,
    Paddle, MercadoPago u otro) todavía no fue elegido — es una
    decisión pendiente del usuario, no técnica.

### Pricing técnicamente soportado hoy

**Ninguno** — el producto no puede cobrar, no puede limitar por plan,
y no puede vencer un trial. El plan de $25/mes + 7 días es una
decisión comercial válida y preservada, pero **no está construida**.

### Gaps

Modelo de datos de suscripción (inexistente), integración con una
pasarela de pago (inexistente, requiere elegir proveedor primero),
lógica de trial (fecha de inicio/vencimiento, bloqueo automático),
lógica de límites por plan (hoy los cupos son fijos, no varían con lo
que se paga).

### Riesgos si se implementara sin pensar

Repetir el mismo error que F14-E1 encontró y corrigió (confiar en un
dato del cliente): un trial nunca debe poder extenderse ni un pago
nunca debe poder falsificarse manipulando el frontend — cualquier
implementación futura de esto debe validar todo en el servidor, igual
que ya es la regla en todo el resto del proyecto.

### Propuesta conceptual (sin construir)

Cuando se decida implementar: un modelo `Subscription` ligado a
`Company` (mismo patrón que cualquier otra configuración de empresa),
con `trialEndsAt`/`status`/`planId`, verificado en el servidor en cada
petición relevante (nunca confiado del cliente) — reutilizando el
mismo criterio de "nunca inventar/confiar en un dato sensible sin
verificarlo" que ya rige todo el proyecto desde F14/F15.

## E4 — Registro y Trial

### Flujo actual real

```
(No existe landing ni CTA público)
        ↓
ADMIN ya existente invita a alguien (correo + nombre + rol)
        ↓
Invitado recibe un token (no se envía por correo real — mismo
límite ya documentado desde Niveles de Acceso)
        ↓
Invitado usa el token en /auth/accept-invitation, pone su contraseña
        ↓
Cuenta activa, ya DENTRO de la empresa que lo invitó
        ↓
(Sin trial — el acceso ya es completo desde el primer login)
```

**Fricciones del flujo actual** (irrelevantes para el signup público
porque el flujo actual no es un signup — es una invitación a un
sistema ya en uso): ninguna real, es un flujo interno bien resuelto.

### Flujo ideal (conceptual, sin implementar)

```
Landing → CTA "Empezar con Alarfly"
        ↓
Registro: correo + contraseña + nombre de la empresa (mínimo posible,
          sin pedir RIF/dirección/moneda todavía — eso ya lo cubre el
          Perfil de Empresa existente en Mi Cuenta, se completa después)
        ↓
Se crea un User nuevo (rol ADMIN) Y una Company nueva en una sola
transacción (patrón `$transaction`, mismo criterio que ya usa todo el
proyecto para operaciones que deben ser atómicas)
        ↓
Login automático (mismo `buildSession` que ya existe)
        ↓
Panel principal, con la barra de progreso de configuración inicial
YA CONSTRUIDA (setup-status.service.js) cumpliendo el rol de
onboarding, sin construir nada nuevo para eso
        ↓
Trial de 7 días corriendo en segundo plano (no existe todavía — E3)
```

**Campos de registro recomendados** (mínimos, para no repetir el
error ya documentado en otras partes del proyecto de pedir
configuración antes de tener datos que la justifiquen): correo,
contraseña, nombre de la empresa. Todo lo demás (RIF, moneda,
sucursales) ya tiene su propia pantalla post-registro
(`ProfileSection`/Perfil de la Empresa) — no hace falta pedirlo dos
veces ni de entrada.

### Trial

No existe. Ver E3 para el diseño conceptual.

## E5 — Embudo Comercial

Ver documento dedicado: **`F16_COMMERCIAL_FUNNEL_AUDIT.md`** (mapa de
embudo actual vs. ideal, eventos existentes/faltantes, candidatos a
activación/conversión, fricciones, oportunidades futuras) — no se
duplica el contenido acá.

## Gaps consolidados

Sin registro público, sin creación de empresa self-service, sin
trial, sin pricing/billing, sin tracking de comportamiento, sin
landing. Los 6 son gaps de **alcance** (nunca se pidió construirlos
antes de ahora), no errores — el producto detrás de ellos está sólido
y ya probado extensamente en F0-F15.

## Deuda

Ninguna deuda nueva de código — la "deuda" de este bloque es
enteramente de alcance de producto (las 6 capacidades ausentes
listadas arriba), no defectos.

## Recomendaciones

1. Antes de construir la landing (E6+), decidir el proveedor de pago
   real — sin eso, cualquier pricing sigue siendo solo una intención.
2. El signup público + creación de empresa es el gap más urgente de
   resolver primero: sin él, ninguna landing tiene a dónde llevar a un
   visitante real.
3. Reutilizar `setup-status.service.js` como onboarding — ya está
   construido y probado, no hace falta un sistema nuevo.
4. Nunca usar en copy la frase "aprende de la conducta de tu empresa"
   (u otra que implique IA activa) en tiempo presente — es visión
   futura, no capacidad actual.
