# F17 — PRODUCT READINESS — BLOQUE 2 (E6-E10)

## 1. Resumen ejecutivo

- **Fecha**: 2026-09-30 / 2026-10-01
- **Bloque**: F17 — Product Readiness, Bloque 2
- **Experiencias**: el prompt de este bloque no definía qué cubre E6-E10
  explícitamente (a diferencia de F16, que sí traía nombres de bloque) —
  se definió el alcance continuando la misma narrativa de "primeras
  semanas de operación real" que ya estableció el Bloque 1 (acceso →
  configuración → primera venta → primera compra → primer cobro/pago),
  documentado explícitamente antes de empezar a trabajar:
  - **E6** — Gestión de Inventario en curso (transferencia entre
    almacenes, conteo físico con maker-checker real)
  - **E7** — Cierre de Periodo y Reportes Financieros (Estado de
    Resultados/Balance General reales, cerrar el periodo, confirmar el
    bloqueo, abrir el siguiente)
  - **E8** — Gestión de Equipo (invitar a un segundo usuario, que esa
    persona pueda aceptar y entrar, y que su menú refleje su rol real)
  - **E9** — Cumplimiento Fiscal en curso (obligación fiscal, escaneo
    de vencimientos, libros fiscales con datos reales)
  - **E10** — Tesorería y Liquidez (importar un extracto bancario real,
    conciliar, completar con excepciones, Previsión de Liquidez)
- **Empresa de prueba**: se reutilizó `F17 Empresa Nueva` (la misma del
  Bloque 1, ya con Plan de Cuentas/periodo/catálogo/primera venta/
  primera compra reales) — apropiado para este bloque porque E6-E10 son
  experiencias de una empresa YA operando, no de una empresa nueva
  desde cero; reutilizarla es más realista que empezar otra vez de cero.
  Datos creados durante este bloque: un segundo almacén, una
  transferencia real, un conteo físico con una diferencia real, una
  cuenta contable nueva (Merma y Ajustes de Inventario, necesaria para
  que el conteo pudiera aprobarse), un segundo usuario real
  (`f17-colaborador@example.com`, rol Colaborador, invitado y activado
  de punta a punta), el periodo de Septiembre 2026 cerrado y Octubre
  2026 creado, una obligación fiscal, y una conciliación bancaria
  completa con 2 movimientos importados.
- **Resultado**: **CERRADO** — las 5 experiencias se completan de
  punta a punta. 2 hallazgos HIGH corregidos (uno de ellos, la
  invitación de equipo, es el hallazgo más importante de todo el
  bloque), 2 MEDIUM corregidos, 0 CRITICAL, 0 deuda bloqueante.

## 2. Estado de E6-E10

| Experiencia | Resultado | Bloqueos | Correcciones | Estado |
|---|---|---:|---:|---|
| E6 — Inventario en curso | Completa de punta a punta | 2 reales (UX de aprobación + bug de fecha) | 2 | Cerrado |
| E7 — Cierre de periodo y reportes | Completa de punta a punta | 0 nuevos | 0 | Cerrado |
| E8 — Gestión de equipo | Completa de punta a punta | 2 reales (sin pantalla de aceptar invitación + menú engañoso) | 2 | Cerrado |
| E9 — Cumplimiento fiscal | Completa de punta a punta | 0 | 0 | Cerrado |
| E10 — Tesorería y liquidez | Completa de punta a punta | 0 | 0 | Cerrado |

## 3. Flujo probado de punta a punta

**E6**: segundo almacén creado → transferencia de 10 unidades
Principal→Secundario (sin asiento contable, como corresponde) → conteo
físico iniciado en Almacén Principal → cantidad editada a mano (una
diferencia real de -3) → enviado → se encontró que CUALQUIER usuario
con rol habilitado veía el botón "Aprobar" aunque fuera quien hizo el
conteo (el backend sí lo bloqueaba, 403, pero el botón invitaba a un
clic que siempre iba a fallar) → corregido → aprobado con un segundo
usuario real (Colaborador) → bloqueado por "no hay cuenta de
merma/ajuste configurada" (mismo patrón de cadena de prerrequisitos ya
visto en el Bloque 1) → cuenta "Merma y Ajustes de Inventario" creada
en el Plan de Cuentas y configurada en Ajustes de Inventario → bloqueado
de nuevo por "no hay un periodo contable que cubra esa fecha" (bug real
de límite de fecha, ver Hallazgo F17-E6-02) → corregido → conteo
aprobado con éxito, ajuste de inventario generado.

**E7**: Estado de Resultados y Balance General generados con datos
reales de todo el bloque anterior (Balance cuadrando exacto, Activo =
Pasivo + Patrimonio) → periodo de Septiembre cerrado → confirmado que
una venta nueva fechada en Septiembre es rechazada (409, mensaje claro)
→ periodo de Octubre 2026 creado sin problema, la operación puede
continuar.

**E8**: usuario invitado desde Niveles de Acceso (rol Colaborador) →
**no existía ninguna pantalla para que esa persona aceptara la
invitación** (ver Hallazgo F17-E8-01, el más importante del bloque) →
construida de cero → invitación aceptada de punta a punta (contraseña
creada, sesión iniciada automáticamente, aterriza en el Panel
principal) → se encontró que el menú lateral mostraba Contabilidad/
Fiscal/FP&A/Reportes/Análisis Avanzados/Métricas del Negocio al
Colaborador aunque su rol no tiene acceso a ninguno (ver Hallazgo
F17-E8-02) → confirmado que el backend SIEMPRE bloqueó correctamente
(403 limpio en 3 de 4 intentos directos por URL, y confirmado con clic
real en el cuarto) → corregido filtrando el menú por el mismo mapa de
roles que ya usa el backend.

**E9**: obligación fiscal "Declaración de IVA" creada (mensual, vence
el día 1) → escaneo de vencimientos corrido (0 alertas nuevas, correcto
porque no hay ninguna regla de alerta configurada todavía — no es un
bloqueo) → Libros Fiscales revisados: el Libro de Ventas mostró
correctamente las 2 facturas reales del Bloque 1 ($130 total), sin
ningún dato simulado.

**E10**: extracto CSV importado a "Banco Principal" (2 movimientos
reales) → conciliación iniciada (01-30 sept) → emparejamiento
automático corrido (0 coincidencias, correcto — no había asientos
previos para esos movimientos de prueba) → intento de generar un
asiento nuevo para un movimiento sin conciliar, bloqueado correctamente
por el periodo ya cerrado en E7 (409, confirma que el bloqueo de
periodo protege también a Tesorería, no solo a Contabilidad) →
conciliación completada igual, con 2 excepciones sin resolver —
reportó la diferencia real (-154,50 US$) con un mensaje claro, sin
bloquear el cierre de la conciliación → Previsión de Liquidez revisada:
saldo inicial correcto ($80, el saldo real de Tesorería — se investigó
una aparente discrepancia con el extracto importado y se confirmó que
es el comportamiento documentado a propósito del proyecto, no un bug:
importar un extracto nunca toca el saldo real por sí solo, solo
emparejar/generar un asiento lo hace), y la cuota de $110 de Cuentas
por Pagar apareció exacta en la semana de su vencimiento real.

## 4. Hallazgos

### F17-E6-01 — MEDIUM
- **Experiencia**: E6
- **Síntoma**: el botón "Aprobar" de un conteo físico pendiente se
  mostraba a CUALQUIER usuario con rol habilitado, incluido quien
  registró ese mismo conteo — el clic siempre terminaba en un error del
  backend ("Quien realizó el conteo no puede aprobar su propio
  ajuste."), nunca en éxito.
- **Causa raíz**: `canApprove` en `PhysicalCountsPage.jsx` solo
  comprobaba el rol, no si el usuario actual era quien contó — a
  diferencia de `PettyCashPage.jsx`, que ya resolvía exactamente el
  mismo problema comparando `registeredByUserId !== user.id`.
- **Archivo/componente**: `frontend/src/pages/inventory/PhysicalCountsPage.jsx`
- **Corrección**: se replicó el mismo patrón ya usado en Caja Chica —
  si `countedByUserId === user.id`, se muestra un aviso explicando por
  qué no puede aprobar en vez del botón condenado a fallar.
- **Pruebas realizadas**: Playwright con 2 usuarios reales — el mismo
  usuario que contó ya no ve el botón (ve el aviso), un usuario
  distinto sí lo ve y aprueba con éxito (200).
- **Estado**: Corregido y verificado.

### F17-E6-02 — HIGH
- **Experiencia**: E6
- **Síntoma**: aprobar un conteo físico fallaba con "No hay un periodo
  contable creado que cubra esa fecha" (404) a pesar de que el periodo
  de Septiembre 2026 estaba abierto y la aprobación ocurría ese mismo
  día (30 de septiembre).
- **Causa raíz**: `physical-counts.service.approveCount` usaba
  `new Date()` (con la hora exacta del momento, ej. 21:51) como fecha
  del ajuste; `core/period-lock.getPeriodForDate` compara con
  `endDate: { gte: date }`, y `AccountingPeriod.endDate` se guarda
  como la medianoche del último día del periodo (`2026-09-30T00:00:00`)
  — cualquier aprobación después de la medianoche del ÚLTIMO día
  calendario del periodo fallaba, aunque ese día siga siendo parte
  legítima del periodo abierto.
- **Archivo/componente**: `src/modules/inventory/services/physical-counts.service.js`
- **Corrección**: se normaliza la fecha a medianoche UTC antes de
  usarla (`new Date(new Date().toISOString().slice(0, 10))`), el mismo
  criterio de "fecha sin hora" que ya usan `AccountingPeriod.startDate`/
  `endDate` y los formularios de fecha del resto del proyecto. **No se
  tocó** `core/period-lock.service.js` (el comparador compartido) ni los
  jobs de cron que tienen el mismo patrón (`fx.cron.js`,
  `fixed-assets.cron.js`) — corren a las 2-3am del día 1 del mes
  siguiente, sin exposición real al mismo límite; se documenta la
  observación acá por si se vuelve relevante más adelante, sin tocarlos
  sin necesidad.
- **Pruebas realizadas**: `npx jest src/modules/inventory` (37/37, sin
  regresión) + verificación en vivo con `curl`/Playwright: 404 antes
  del fix, 200 después, con el ajuste de inventario generado
  correctamente.
- **Estado**: Corregido y verificado. Sin test unitario nuevo dedicado
  (fix mecánico de una línea, mismo criterio ya usado en otros fixes
  puntuales de este proyecto — verificado con evidencia real en vivo en
  su lugar, no solo con Jest).

### F17-E8-01 — HIGH (el hallazgo más importante del bloque)
- **Experiencia**: E8
- **Síntoma**: un Administrador podía invitar a alguien desde Niveles
  de Acceso, pero la persona invitada **no tenía ninguna forma de
  aceptar la invitación y entrar** — el token se mostraba como texto
  crudo con la instrucción "cópialo y compártelo a mano", pero no
  existía ninguna pantalla en todo el frontend donde pegarlo.
- **Causa raíz**: el backend (`POST /auth/accept-invitation`) estaba
  completo, probado y devolvía una sesión completa (igual que login)
  desde que se construyó el módulo de Niveles de Acceso — nunca se
  construyó la interfaz correspondiente. Mismo patrón exacto que los 2
  hallazgos más importantes del Bloque 1 (plantilla de Plan de Cuentas,
  Ajustes de Cuentas por Cobrar y por Pagar): una capacidad de backend
  real, probada, sin ninguna puerta de entrada en el frontend.
- **Archivo/componente**: no existía — nuevo
  `frontend/src/pages/AcceptInvitationPage.jsx`,
  `frontend/src/context/AuthContext.jsx` (+`acceptInvitation`),
  `frontend/src/App.jsx` (+ruta pública `/aceptar-invitacion`),
  `frontend/src/modules/niveles-acceso/NivelesAccesoPage.jsx` (el
  token crudo se reemplazó por un enlace real copiable).
- **Corrección**: pantalla nueva, mínima, consistente con el patrón
  visual ya usado en `LoginPage` — lee el token de la URL
  (`?token=...`), pide contraseña + confirmación, llama al endpoint ya
  existente, e inicia sesión automáticamente (reutilizando el mismo
  mecanismo de sesión que ya usa el login normal). No se tocó
  `core/auth` ni ninguna lógica de backend.
- **Pruebas realizadas**: flujo completo con Playwright — invitación
  creada (201) → enlace copiable confirmado en la UI → aceptada en una
  sesión de navegador separada (200) → sesión real iniciada, aterrizó
  en el Panel principal con el rol y nombre correctos, confirmado con
  `GET` reales, no solo visualmente.
- **Estado**: Corregido y verificado.

### F17-E8-02 — MEDIUM
- **Experiencia**: E8
- **Síntoma**: el menú lateral mostraba enlaces a Contabilidad, Fiscal,
  FP&A, Reportes, Métricas del Negocio y Análisis Avanzados a un
  usuario Colaborador, aunque su rol no tiene acceso a ninguno de esos
  módulos — en la mayoría de los casos el usuario veía de inmediato "No
  tienes acceso a este módulo con tu rol actual." al entrar (la propia
  pantalla carga datos al abrir y el 403 aparece solo), pero en
  Reportes (que no carga nada hasta pulsar "Generar") el formulario
  completo se veía usable, y el bloqueo real solo aparecía después de
  rellenar todo y enviar. **Confirmado explícitamente que esto nunca
  fue un hueco de seguridad** — el backend (`requireModuleAccess`)
  bloqueó los 4 intentos probados con 403 real y el mensaje correcto;
  el problema es exclusivamente de navegación engañosa.
- **Causa raíz**: `NAV_AREAS` en `AppLayout.jsx` es una lista estática
  sin ningún filtro por rol — a diferencia de `DashboardPage.jsx`, que
  ya tenía una copia local de `MODULE_ROLES` (`ACCOUNTING_ROLES`/
  `SALES_ROLES`) para no mostrarle al usuario contenido que el
  servidor le va a negar.
- **Archivo/componente**:
  `frontend/src/components/AppLayout.jsx`, nuevo
  `frontend/src/config/moduleAccess.js`.
- **Corrección**: se creó `moduleAccess.js` (copia fiel de
  `core/rbac/module-access.js`, mismo patrón ya aceptado en
  `DashboardPage.jsx`) y se filtra `navAreas` reutilizando
  `moduleKeyForPath` (ya existente, usado por el botón de ayuda
  contextual) antes de renderizar — un grupo que queda sin ítems visibles
  (ej. "Control" si solo tenía Fiscal) también se oculta completo.
- **Pruebas realizadas**: Playwright comparando el menú de un
  Colaborador (6 ítems: Inicio/Ventas/Inventario/Finanzas/Tesorería/
  Cuentas por Cobrar y Pagar) contra el de un Administrador (14 ítems,
  sin cambios) — confirmado que ADMIN no perdió ningún acceso.
- **Estado**: Corregido y verificado.

### Observación documentada (no es un hallazgo, no se corrigió)
Durante E7 se detectó que la cuenta GL "Bancos" del Balance General
mostraba un saldo muy distinto (-920,00 US$) del saldo real de la
cuenta de Tesorería vinculada (80,00 US$ en ese momento). Investigado a
fondo: **no es un bug** — es consecuencia de que, durante las pruebas
del Bloque 1 y 2, se eligió "Bancos" como cuenta contrapartida de
entradas de inventario que nunca pasaron por una transacción real de
Tesorería (una entrada manual de $1.000 en Movimientos de Inventario).
El sistema ya documenta explícitamente esta regla de diseño
("Una entrada de inventario exige que quien la registra indique la
cuenta contrapartida... no se asume ninguna por defecto") — el Balance
General es matemáticamente correcto (`totalAssets === totalLiabilitiesAndEquity`
en todo momento), el "problema" es enteramente de qué cuenta eligió
quien hizo la prueba, no del cálculo. No se modificó nada; se documenta
acá para que no se re-investigue como si fuera un hallazgo nuevo.

## 5. Tests

- **Antes del bloque** (tras restaurar el entorno, ver sección 9):
  708/708 (confirmado con una segunda corrida tras el primer intento,
  que falló por 2 tests con una colisión transitoria de conexión a
  Postgres justo después de reiniciarlo — no relacionado con ningún
  cambio de código).
- **Después del bloque**: 708/708, sin regresiones.
- **Tests nuevos**: 0 — los 2 fixes de código de este bloque
  (`PhysicalCountsPage.jsx`, `physical-counts.service.js`) son
  correcciones mecánicas pequeñas (una condición de visibilidad, una
  normalización de fecha) verificadas con evidencia real en vivo
  (Playwright + Postgres real, 2 usuarios reales), mismo criterio ya
  usado repetidamente en este proyecto para fixes de este tamaño sin
  lógica pura nueva que amerite un test de Jest dedicado.
- `npx jest src/modules/inventory`: 37/37 (verificación focalizada
  antes de la corrida completa).

## 6. Playwright

Flujos ejecutados de punta a punta contra los dos servidores reales y
Postgres real, con capturas de pantalla en cada paso clave:
- E6: creación de almacén, transferencia, conteo físico (iniciar →
  editar → enviar → intento de auto-aprobación bloqueado → aprobación
  cruzada exitosa con 2 usuarios reales).
- E7: generación de Estado de Resultados/Balance General, cierre de
  periodo con diálogo de confirmación, venta bloqueada en periodo
  cerrado, creación del periodo siguiente.
- E8: invitación creada, enlace copiable verificado, aceptación en una
  sesión de navegador separada (simulando a la persona invitada en su
  propio dispositivo), comparación de menú por rol.
- E9: obligación fiscal creada, escaneo ejecutado, Libro de Ventas
  revisado con datos reales.
- E10: importación CSV, inicio de conciliación, emparejamiento
  automático, intento de generar asiento (bloqueado correctamente por
  periodo cerrado), conciliación completada con excepciones, Previsión
  de Liquidez revisada.

**Fallos encontrados durante la escritura de los propios scripts de
prueba** (no son hallazgos del producto, documentados para no
confundirlos): selectores ambiguos por texto compartido (`"Cerrar"`
coincidiendo con el botón de cerrar SESIÓN del sidebar, provocando un
logout accidental en un intento; `"Aprobar"`/`"Completar conciliación"`
coincidiendo entre el botón de la pantalla y el botón del diálogo de
confirmación) — corregidos en los propios scripts con
`getByRole(..., { name, exact: true })`, sin relación con el producto.

## 7. Responsive

41 combinaciones verificadas (1440/1280/1024/768/390px × 8 pantallas
tocadas o centrales de este bloque — Conteos Físicos, Transferencias,
Periodos, Estados Financieros, Calendario Fiscal, Conciliación
Bancaria, Previsión de Liquidez, Niveles de Acceso — más la pantalla
nueva `AcceptInvitationPage` a 390px sin sesión) — **0 desbordes
horizontales** (`scrollWidth === clientWidth` exacto en las 41),
incluida la pantalla de 390px que corresponde al bug CRITICAL ya
corregido en F16-E19. Sin regresión.

## 8. Auditoría

Operaciones sensibles de este bloque verificadas contra el sistema
CORE/AUDIT ya existente (`core/audit`), sin crear ningún mecanismo
nuevo:
- `user.invitation_accepted` — ya registrado por
  `core/auth/auth.service.acceptInvitation` desde que se construyó esa
  función (sin cambios de este bloque); confirmado que el flujo nuevo
  del frontend dispara exactamente esa misma auditoría, no una nueva.
- Aprobación de conteo físico — ya pasa por el mismo patrón de
  `approvedByUserId`/`approvedAt` que el resto del proyecto usa para
  dejar rastro de quién aprobó qué.
- Cierre de periodo contable — ya registrado por
  `core/period-lock.service.closePeriod` (sin cambios de este bloque).

## 9. Regresiones

Áreas revisadas después de las modificaciones de este bloque:
- `src/modules/inventory/**` (por el fix de fecha en
  `physical-counts.service.js`): `npx jest src/modules/inventory`
  (37/37) + suite completa (708/708).
- `frontend/src/components/AppLayout.jsx` (por el filtro de navegación
  nuevo): confirmado que el menú de ADMIN no perdió ningún ítem (14/14
  igual que antes), y que los 8 módulos de negocio + Finanzas + Mi
  Cuenta siguen siendo alcanzables para los roles que ya los tenían.
- **Incidente de entorno, no del código**: al reanudar este bloque tras
  un corte de sesión, Postgres y ambos servidores (backend/frontend)
  estaban caídos — reiniciados los 3 antes de cualquier verificación
  nueva (`pg_ctlcluster 16 main start`, `node src/server.js`,
  `npm run dev`), confirmado con `/health` y una carga real de página
  antes de continuar. Esto causó 2 fallos transitorios en la primera
  corrida de `npm test` (colisión de conexión a Postgres justo después
  de levantarlo) — resueltos solos en la segunda corrida, sin tocar
  ningún código. No se relacionan con ningún cambio de este bloque.

## 10. Deudas

- **LOW**: la plantilla "Plan de Cuentas Estándar" no incluye ninguna
  cuenta de "Merma y Ajustes de Inventario" — cualquier empresa nueva
  que use Conteos Físicos con una diferencia real topará con el mismo
  bloqueo ya resuelto en este bloque (crear la cuenta a mano). No se
  tocó la plantilla en sí (está fuera del alcance de E6-E10, y
  modificarla es una decisión de producto, no una corrección de bug) —
  documentado para que se considere agregarla la próxima vez que se
  revise la plantilla.
- **DEUDA**: ninguna otra. No quedó ningún hallazgo CRITICAL o HIGH sin
  corregir en este bloque.
- **FUERA DE ALCANCE**: no se tocó el sistema de notificación por
  correo de invitaciones (sigue siendo "copiar y compartir a mano",
  documentado como límite consciente desde antes de este bloque — el
  proyecto nunca ha tenido servidor de correo saliente). No se amplió
  el alcance de este bloque para resolverlo; la pantalla de aceptación
  ya lo hace usable de punta a punta sin necesitar correo.

## 11. Decisiones arquitectónicas

- **No se tocó `core/period-lock.service.js`** (el comparador
  compartido de fechas contra periodos) para corregir F17-E6-02 — el
  fix se aplicó en el único call site real afectado
  (`physical-counts.service.approveCount`), normalizando la fecha antes
  de usarla, en vez de cambiar la semántica de comparación compartida
  por todo el proyecto (Ledger, cierre de periodo, FX, depreciación,
  etc.) — cambiar ese comparador habría sido exactamente el tipo de
  modificación "innecesaria a Ledger/motor contable" que el prompt de
  este bloque prohíbe explícitamente sin justificación fuerte.
- **`moduleAccess.js` es una copia deliberada, no una importación
  compartida**, del mapa de roles del backend — mismo patrón ya
  aceptado y en producción en `DashboardPage.jsx` desde antes de este
  bloque (frontend y backend son dos proyectos/despliegues separados
  sin un paquete compartido; duplicar un mapa de configuración simple
  es la solución ya establecida en este proyecto para este problema
  exacto, no una decisión nueva).
- **La pantalla de aceptar invitación no envía correo**: reutiliza el
  mismo patrón ya aceptado del proyecto ("copiar y compartir a mano")
  — no se construyó infraestructura de email nueva, que habría sido
  una funcionalidad fuera del alcance de "corregir bloqueos reales".

## 12. Resultado final

# CERRADO

Las 5 experiencias (E6-E10) se completan de punta a punta con
evidencia real. 0 CRITICAL, 2 HIGH (ambos corregidos y verificados),
2 MEDIUM (ambos corregidos y verificados), 0 LOW bloqueante (1 LOW de
deuda documentada, no bloqueante), 708/708 tests, lint y build limpios,
41/41 combinaciones responsivas sin desborde, auditoría confirmada
donde corresponde, sin regresiones relevantes.
