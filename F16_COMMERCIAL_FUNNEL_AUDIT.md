# F16_COMMERCIAL_FUNNEL_AUDIT.md — Embudo Comercial (E5)

> Nota de fuente: el usuario mencionó un archivo `Markdown.md`
> ("Cuestionario Maestro de Landing Page") como fuente de verdad
> comercial. **Ese archivo no se encontró en el repositorio ni en el
> sistema de archivos de esta sesión** — se buscó explícitamente y no
> apareció. Lo que sí existe es el resumen de ese cuestionario que el
> propio usuario incluyó dentro del pedido de esta fase, y es lo que
> se usó como fuente de verdad para este documento. Si el archivo
> real existe en otro lugar, hay que compartirlo para revisarlo
> directamente en una próxima sesión.

## 1. Funnel actual (lo que existe de verdad hoy)

```
VISITA           → NO EXISTE (sin landing, sin ruta pública)
ENTENDIMIENTO     → NO EXISTE
INTERÉS           → NO EXISTE
REGISTRO          → NO EXISTE (sin signup público)
PRIMER VALOR      → Existe DESPUÉS de que un ADMIN ya invitó al usuario
ACTIVACIÓN        → Existe parcialmente (barra de progreso de configuración)
PRUEBA (trial)    → NO EXISTE (sin concepto de prueba en el sistema)
CONVERSIÓN        → NO EXISTE (sin pago, sin plan, sin suscripción)
RETENCIÓN         → Sin medir (el producto se usa, pero nada lo registra como "retención")
RECOMENDACIÓN     → NO EXISTE
```

El embudo real de Alarfly hoy **empieza en el medio**: un ADMIN ya
existente invita a alguien (`access-levels/services/users.service.js
inviteUser`), esa persona acepta la invitación
(`core/auth.acceptInvitation`) y entra directo a un panel ya
funcional. Todo lo que hay ANTES de eso (que alguien llegue solo,
entienda qué es Alarfly, se registre por su cuenta y pruebe el
producto sin que nadie lo invite) **no existe todavía en ningún
punto del código**.

## 2. Funnel ideal (conceptual, sin implementar)

```
VISITA         → Landing pública (no existe hoy)
ENTENDIMIENTO  → La landing explica el producto con capacidades reales
INTERÉS        → CTA "Empezar con Alarfly"
REGISTRO       → Signup público: correo + contraseña + nombre de la empresa (mínimo)
                 → crea un User nuevo Y una Company nueva (ninguno de los dos
                   flujos existe hoy fuera del seed)
PRIMER VALOR   → Panel principal con datos reales de ESA empresa nueva
                 (ya existe, funciona en cuanto hay una empresa+usuario)
ACTIVACIÓN     → El usuario completa al menos 1 de los 4 pasos de
                 configuración inicial (ya existe: setup-status.service.js)
TRIAL          → 7 días desde el registro (no existe ningún campo que
                 lo represente hoy — ver E3/E4)
CONVERSIÓN     → Pago real, plan activo (no existe ningún mecanismo — ver E3)
RETENCIÓN      → Usuario vuelve a iniciar sesión / sigue registrando
                 movimientos (se podría medir con UserSession + AuditLog
                 ya existentes, pero hoy nadie lo agrega ni lo reporta)
RECOMENDACIÓN  → No existe ningún mecanismo de referido
```

## 3. Eventos que YA se pueden medir con lo que existe

Ninguno de estos es "analítica comercial" — son datos que el sistema
ya registra para otros fines, pero que se podrían **reutilizar** sin
construir nada nuevo:

| Evento | Fuente real ya existente |
|---|---|
| signup completed (de la forma actual: invitación aceptada) | `AuditLog` con `action: 'user.invitation_accepted'` |
| company created | `Company.createdAt` |
| first login | `UserSession.createdAt` (la primera fila de ese usuario) |
| first product / first customer | ya es literalmente uno de los 4 pasos de `setup-status.service.js` |
| dashboard viewed | NO se registra — Inicio no deja ningún rastro de haberse visto |
| trial started / trial expired | NO EXISTE ningún campo `trial*` en todo el schema |
| payment / subscription | NO EXISTE ningún modelo de pago/plan en todo el schema |

## 4. Eventos que faltan por completo (NOT TRACKED)

- landing visit
- CTA click
- signup started (a diferencia de "completado", no hay ningún rastro
  de un registro empezado y abandonado)
- trial started / trial expired
- payment / subscription

**Ninguno de estos se inventa ni se simula** — se listan como
`NOT TRACKED`, tal como pide explícitamente esta etapa.

## 5. Métricas existentes vs. faltantes

**Existentes** (reutilizables, ya construidas para otro propósito):
`AuditLog` (quién hizo qué y cuándo, por empresa), `UserSession`
(inicios de sesión reales), `setup-status.service` (4 señales de
activación ya verificadas contra el sistema real, nunca autodeclaradas).

**Faltantes**: cualquier métrica específicamente comercial (tasa de
registro, tasa de activación, tasa de conversión a pago, retención a
7/30 días, LTV, CAC) — ninguna existe porque ninguna de las etapas que
las alimentan (landing, signup público, trial, pago) existe todavía.

## 6. Candidato a "Activación"

**No se asume que "crear una cuenta" sea activación.** El candidato
real, ya construido y ya validado contra el sistema (`setup-status.service.js`),
es: **el usuario completó al menos uno de los 4 pasos reales** (RIF
configurado, primera cuenta bancaria, primer producto o cliente,
invitó a alguien más) — porque cada uno de esos 4 es la primera vez
que el usuario le confía a Alarfly un dato real de su negocio, no solo
un login. Es la definición más cercana a "el usuario entendió el valor
de Alarfly" que ya tiene evidencia real detrás, sin inventar nada
nuevo.

## 7. Candidato a "Conversión"

**No se puede definir todavía** — conversión significa "empezó a
pagar", y no existe ningún concepto de pago en el sistema. El
candidato conceptual (sin implementar) sería: primera transacción de
pago procesada con éxito contra el plan de $25/mes ya decidido en el
cuestionario — pendiente de que exista billing real (ver E3).

## 8. Principales puntos de fricción (del embudo IDEAL, ya que el actual ni siquiera arranca)

1. **No hay por dónde entrar**: sin landing ni signup público, el
   embudo completo (visita→registro) es hoy un muro, no una fricción
   puntual — es la ausencia total del primer tramo.
2. **Registro y creación de empresa nunca se probaron juntos**: hoy
   "crear un usuario" y "crear una empresa" son dos operaciones
   separadas (usadas solo por el seed) — nunca se construyó el camino
   de "una persona nueva crea su propia empresa desde cero", que es
   justamente lo que un signup público necesita.
3. **Sin trial real**: el cuestionario ya definió "7 días gratis", pero
   no hay ningún mecanismo que cuente esos días ni que bloquee nada al
   vencerse.

## 9. Oportunidades futuras (no implementar todavía)

- Registrar `signupStartedAt`/`trialStartedAt`/`trialEndsAt` en
  `Company` (mismo patrón ya usado para otros campos de configuración
  de empresa) el día que se construya el signup público real.
- Reutilizar `AuditLog`/`UserSession` como base de un reporte de
  activación/retención simple, sin instalar ninguna herramienta de
  analítica externa — coherente con la misma disciplina de "reutilizar
  antes de construir" de F13-F15.
