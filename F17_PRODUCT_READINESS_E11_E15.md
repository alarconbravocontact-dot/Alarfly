# F17 — PRODUCT READINESS — BLOQUE 3 (E11-E15)

## 1. Resumen ejecutivo

- **Fecha**: 2026-10-02
- **Bloque**: F17 — Product Readiness, Bloque 3
- **Empresa de prueba**: se reutilizó `F17 Empresa Nueva` (la misma de
  los Bloques 1 y 2, confirmada intacta al retomar el trabajo: periodo
  de Septiembre 2026 cerrado, Octubre 2026 abierto, los 2 usuarios
  previos activos) — apropiado para este bloque porque E11-E15 son
  experiencias de una empresa ya operando (configurar presupuestos,
  administrar la propia cuenta, recibir alertas, correr análisis,
  exportar reportes), no de una empresa nueva desde cero. Datos
  creados durante este bloque: una `FpaDimension` real ("Ventas
  Generales"), un `Budget` 2026 con una línea presupuestal real,
  una etiqueta de dimensión sobre una línea de asiento real (el
  hallazgo principal de este bloque), 2FA activado y desactivado de
  punta a punta sobre el usuario Administrador, una regla de saldo
  bajo configurada y escaneada, un análisis Vertical real archivado
  (con sus 6 partes), un reporte programado real (`cash-flow`,
  mensual) corrido a mano, y un tercer usuario real (`Contador F17`,
  rol `ACCOUNTANT`, invitado y activado de punta a punta — necesario
  para verificar una corrección de permisos de este mismo bloque).
- **Resultado**: **CERRADO** — las 5 experiencias se completan de
  punta a punta. 1 hallazgo HIGH corregido (el más importante del
  bloque: la función central de FP&A para "Desviaciones" nunca podía
  mostrar un dato real porque no existía ninguna pantalla para
  etiquetar una línea de asiento), 1 MEDIUM corregido (un permiso del
  frontend que no calzaba con el backend real, descubierto al verificar
  el propio fix del hallazgo HIGH), 0 CRITICAL, 0 deuda bloqueante.

## 2. Definición de E11–E15

Antes de tocar cualquier código se hizo la búsqueda exhaustiva que pide
explícitamente el prompt de este bloque ("PRIMERA REGLA: NO INVENTAR
E11–E15"):

- `grep`/lectura completa de `PROGRESS_LOG.md`, `F17_PRODUCT_READINESS_E1_E5.md`
  y `F17_PRODUCT_READINESS_E6_E10.md` buscando cualquier mención previa
  de "E11", "E12", "E13", "E14" o "E15" dentro del contexto de F17.
- Búsqueda de cualquier "Mapa Maestro"/"Plan Maestro"/documento
  funcional que enumerara experiencias de usuario numeradas para F17
  específicamente (no existe tal documento en el repositorio — la
  única fuente de verdad del proyecto es `CLAUDE.md`, que tampoco
  enumera experiencias E1-E20 en ningún lado).
- Búsqueda en todo el repositorio (`grep -rn "E11\|E12\|E13\|E14\|E15"`)
  de cualquier referencia en código, tests o comentarios.

**Resultado de la búsqueda**: las únicas apariciones de "E11" a "E15"
en todo el proyecto pertenecen inequívocamente a **F14** (Enterprise:
FX/Permisos/Políticas/Aprobaciones) y **F16** (Growth:
Métricas/Experimentación/Referidos/Afiliados/Growth Loops) — dos
iniciativas completamente distintas, de otro tema, sin relación con
F17. **No existe ninguna definición previa de E11-E15 para F17
específicamente**, ni en `PROGRESS_LOG.md`, ni en los dos reportes ya
entregados de este mismo F17, ni en ningún documento funcional, ni en
código, ni en tests.

Esto se documentó explícitamente al usuario antes de definir nada (ver
la respuesta de esta misma sesión), tal como exige la regla cuando las
fuentes "contradicen o están ausentes" — no se continuó basándose en
una suposición silenciosa.

**Definición adoptada** (continuando la misma narrativa de "una empresa
que ya opera y va madurando sus procesos" que ya establecieron los
Bloques 1 y 2 — acceso → configuración → primera venta → primera
compra → primer cobro/pago → inventario en curso → cierre de periodo →
gestión de equipo → cumplimiento fiscal → tesorería, y ahora sigue con
las piezas de gestión y control que le siguen a una empresa que ya
opera bien):

- **E11** — Presupuesto y Desviaciones (FP&A): crear una dimensión
  analítica, un presupuesto, etiquetar una transacción real con esa
  dimensión, aprobar el presupuesto, y confirmar que el reporte de
  Desviaciones compara lo real contra lo presupuestado con datos
  genuinos.
- **E12** — Mi Cuenta y Seguridad: editar el perfil propio, cambiar la
  contraseña, activar la verificación en dos pasos (2FA) de punta a
  punta (código QR → login exige el código → desactivar).
- **E13** — Centro de Notificaciones y Alertas: configurar una regla de
  alerta real, disparar el escaneo, confirmar que la notificación
  aparece en el Centro de Notificaciones, navegar desde ahí a la
  pantalla de origen, y marcarla como atendida.
- **E14** — Análisis Avanzados: correr al menos uno de los 16 tipos de
  análisis financiero de punta a punta y confirmar que las 6 partes
  obligatorias (resultado numérico, tipo de gráfico, causa,
  interpretación simple, metodología, sugerencias cuantificadas)
  aparecen completas tanto en la respuesta del backend como en la
  pantalla real.
- **E15** — Exportación y Reportes Programados: exportar un reporte
  puntual a PDF/Excel y crear + correr a mano un reporte programado,
  confirmando que el archivo se genera correctamente.

## 3. Estado de E11-E15

| Experiencia | Resultado | Bloqueos | Correcciones | Estado |
|---|---|---:|---:|---|
| E11 — Presupuesto y Desviaciones | Completa de punta a punta | 1 real (HIGH, sin UI de etiquetado) + 1 real (MEDIUM, permiso desalineado) | 2 | Cerrado |
| E12 — Mi Cuenta y Seguridad | Completa de punta a punta | 0 | 0 | Cerrado |
| E13 — Centro de Notificaciones y Alertas | Completa de punta a punta | 0 | 0 | Cerrado |
| E14 — Análisis Avanzados | Completa de punta a punta | 0 | 0 | Cerrado |
| E15 — Exportación y Reportes Programados | Completa de punta a punta | 0 | 0 | Cerrado |

## 4. Flujo probado de punta a punta

**E11**: se intentó usar el flujo real completo — crear una
`FpaDimension` ("Ventas Generales"), crear un `Budget` ORIGINAL 2026,
abrir una factura de venta real ya existente (Septiembre 2026, cuenta
"4135 · Ventas", $50) y etiquetar su línea de Ventas con la dimensión
recién creada desde la pantalla de Asientos Contables. **Acá se
encontró que esa pantalla de etiquetado no existía en ningún lugar del
frontend** (ver Hallazgo F17-E11-01). Se construyó la pieza faltante
(detallada abajo), se etiquetó la línea real con éxito, se agregó una
línea presupuestal real a "Presupuesto 2026" (cuenta 4135, dimensión
"Ventas Generales", mes 9, monto fijo $40), se transicionó el
presupuesto DRAFT→IN_REVIEW→APPROVED, y el reporte de Desviaciones
mostró exactamente lo esperado: presupuestado $40.00, real $50.00,
desviación $10.00 (25.00%), "Requiere justificación" — confirmado
tanto por API como en la pantalla real (`/fpa/desviaciones`), con el
gráfico y la tabla mostrando los montos reales. Se probó también
"Quitar" la etiqueta (204, el `select` + botón "Etiquetar" vuelven a
aparecer) y volver a etiquetar (201) — las dos direcciones confirmadas
funcionando. Al verificar quién puede ver este control nuevo se
encontró el segundo hallazgo del bloque (F17-E11-02, MEDIUM, ver
abajo), corregido y reverificado con un tercer usuario real
(`Contador F17`, rol `ACCOUNTANT`, invitado y aceptado de punta a
punta).

**E12**: como Administrador — pantalla de Perfil cargada con el campo
Nombre editable (confirmado con el valor real "Admin F17"); pantalla
de Seguridad confirmada con el formulario de cambio de contraseña, el
área de 2FA y la tabla de sesiones activas. Ciclo completo de 2FA
probado contra el backend real (API, generando códigos TOTP reales con
la misma librería `otplib` que usa el servidor): `setup` (200, secreto
+ QR reales) → `verify` con el código generado (200, `enabled: true`)
→ login posterior exige 2FA (`requiresTwoFactor: true`, `pendingToken`)
→ código incorrecto rechazado (401, `INVALID_2FA_CODE`) → código
correcto acepta y entrega sesión real (200) → `disable` con contraseña
+ código (200, `enabled: false`) → login vuelve a ser directo, sin
pedir el segundo paso (confirmado `requiresTwoFactor: false`). Sin
ningún bloqueo.

**E13**: se configuró `TreasuryAccount.lowBalanceThreshold = 1000` en
la única cuenta bancaria real de la empresa (saldo real $80), se corrió
`POST /treasury/alerts/scan` (generó la alerta `LOW_BALANCE` real), y
se confirmó en la campana del Centro de Notificaciones: insignia "1",
mensaje real ("La cuenta "Banco Principal" tiene saldo bajo..."), clic
en la notificación navega correctamente a `/tesoreria/cuentas` (el
mapa `alertLink` real), y el botón "✓" la marca como atendida (200,
desaparece de la lista y la insignia se oculta). Sin ningún bloqueo.

**E14**: se corrió `POST /advanced-analytics/run` con `analysisType:
VERTICAL` sobre el Balance General real al 2026-09-30 — la respuesta
(201) trajo las 6 partes completas y no vacías (`numericResult` con
filas reales por cuenta, `chartType: COMPOSITION`, `causeExplanation`
con la cuenta más grande real ("Inventario", 483.1%),
`simpleInterpretation`, `methodology`, y `recommendations` con un ítem
cuantificado real). Confirmado también en la pantalla real
(`/analisis-avanzados/repositorio`): gráfico de pastel renderizado,
tabla de resultado numérico, "¿Por qué dio este resultado?", "Qué
significa esto para tu negocio", "Ver cómo se calculó" (colapsable), y
"Sugerencias" con la insignia cuantificada "483.1%" — capturas de
pantalla revisadas una por una. Sin ningún bloqueo.

**E15**: se exportó el propio reporte Vertical recién generado a PDF
(200, 2491 bytes, confirmado "PDF document, version 1.3, 1 page(s)"
con `file`) y a Excel (200, 7247 bytes, confirmado "Microsoft Excel
2007+"). Se creó un `ScheduledReport` real (`cash-flow`, mensual,
formato PDF, rango real de Septiembre 2026) y se corrió a mano con
`POST /reports/scheduled/:id/run` (200, PDF real de 1866 bytes,
`lastRunAt` actualizado en la base de datos real). Confirmado en la
pantalla real (`/reportes/exportar`) que el reporte programado
("Flujo de Efectivo") aparece en la tabla. Sin ningún bloqueo.

## 5. Hallazgos

### F17-E11-01 — HIGH (el hallazgo más importante del bloque)
- **Experiencia**: E11
- **Síntoma**: el reporte de Desviaciones de FP&A (documentado en
  `CLAUDE.md` como "completo y probado") depende, por diseño, de que
  una línea de asiento real esté etiquetada con la misma
  `FpaDimension` que una línea de presupuesto, para poder comparar lo
  real contra lo presupuestado. El backend para etiquetar/quitar esa
  etiqueta (`POST /fpa/dimensions/tags`, `DELETE
  /fpa/dimensions/tags/:tagId`) existía completo y probado desde que
  se construyó el punto 1 de FP&A — pero **no existía ningún botón, ni
  ninguna pantalla, en todo el frontend, desde donde una persona real
  pudiera etiquetar una línea de asiento**. Sin esta pieza, cualquier
  empresa real que configurara un presupuesto vería el reporte de
  Desviaciones siempre con "real = $0" (100% desfavorable), sin
  ninguna forma de corregirlo desde la interfaz — el mismo patrón ya
  encontrado 3 veces en este proyecto ("backend completo, cero
  interfaz") y documentado en `CLAUDE.md`, ahora una cuarta vez.
- **Causa raíz**: nunca se construyó la pieza de interfaz
  correspondiente al endpoint ya existente — ni como parte de FP&A, ni
  como parte de Contabilidad (la pantalla natural, porque etiquetar es
  una acción sobre una línea de un asiento ya registrado, no sobre un
  presupuesto).
- **Archivo/componente**: `frontend/src/pages/accounting/JournalEntriesPage.jsx`
  (nueva columna "Dimensión FP&A" en el detalle expandido de un
  asiento, con un `select` + botón "Etiquetar" para una línea sin
  etiqueta, y un `StatusSeal` + botón "Quitar" para una línea ya
  etiquetada), `frontend/src/api/fpa.js` (nuevos métodos
  `tagLine`/`untagLine`, envoltura de los 2 endpoints ya existentes).
- **Bug secundario encontrado durante la implementación, corregido en
  el camino**: `src/core/ledger/ledger.service.js` (`getEntry`) nunca
  incluía `fpaDimensionTags` en su consulta de Prisma — necesario para
  que el detalle de un asiento pudiera mostrar (y esta pieza nueva,
  gestionar) con qué dimensión ya está etiquetada una línea. El primer
  intento de este include usó el nombre de relación `dimension` (por
  analogía con `dimensionTags: { include: { dimension: true } }`, el
  campo ya existente de Tesorería) — pero `JournalEntryLineFpaDimension`
  nombra esa relación `fpaDimension`, no `dimension` (confirmado en
  `prisma/schema.prisma`); el nombre equivocado producía un error 500
  real de Prisma ("Unknown field `dimension`") al abrir el detalle de
  **cualquier** asiento, no solo uno etiquetado — encontrado de
  inmediato al verificar con `curl` antes de dar el fix por bueno, y
  corregido a `fpaDimension` antes de continuar. Cambio puramente de
  lectura, no toca ninguna escritura del motor de asientos.
- **Corrección**: las 2 piezas de arriba, construidas juntas.
- **Pruebas realizadas**: Playwright + `curl` contra Postgres real de
  punta a punta — etiquetar una línea real (201), confirmar que
  persiste con una segunda lectura limpia de la API (`fpaDimensionTags`
  con el objeto `fpaDimension` completo), ver el `StatusSeal` real en
  pantalla, quitar la etiqueta (204, vuelve a aparecer el `select`),
  volver a etiquetar (201); el flujo completo de presupuesto +
  aprobación + reporte de Desviaciones mostrando el 25% de desviación
  real, confirmado tanto por API como en la pantalla
  `/fpa/desviaciones`. 708/708 tests de backend sin regresión, lint y
  build limpios, responsive sin desborde en 390/768/1440px.
- **Estado**: Corregido y verificado.

### F17-E11-02 — MEDIUM (encontrado al verificar el propio fix de arriba)
- **Experiencia**: E11
- **Síntoma**: el botón "Etiquetar"/"Quitar" que se acababa de
  construir (F17-E11-01) se mostraba a cualquier usuario con rol
  `ADMIN` o `ACCOUNTANT` (reutilizando `canRecord`, la misma variable
  que ya controla quién puede registrar un asiento) — pero el
  endpoint real de etiquetado (`POST /fpa/dimensions/tags`) exige
  `ADMIN` o `FINANCE` (`fpa-dimensions.routes.js`, `canManage =
  requireRole('ADMIN', 'FINANCE')`), **no** `ACCOUNTANT`. Un usuario
  real con rol Contador (que sí tiene acceso completo a Contabilidad,
  incluida la pantalla de Asientos) habría visto el botón "Etiquetar"
  y recibido un 403 confuso al hacer clic — el mismo tipo exacto de
  "permiso del frontend que no calza con el backend real" ya
  encontrado en el Bloque 2 (F17-E8-02, aunque ahí era al revés:
  mostraba de más en el menú).
- **Causa raíz**: al construir la pieza nueva se reutilizó la variable
  `canRecord` existente (ADMIN/ACCOUNTANT, el rol correcto para
  *registrar* un asiento) sin verificar que el permiso real del
  endpoint de *etiquetado* (un recurso de FP&A, no de Contabilidad) es
  distinto (ADMIN/FINANCE, por `core/rbac/module-access.js`: el
  módulo `fpa` completo —incluida la propia lectura de
  `GET /fpa/dimensions`— solo está abierto a esos 2 roles).
- **Archivo/componente**: `frontend/src/pages/accounting/JournalEntriesPage.jsx`
- **Corrección**: se agregó una variable nueva y específica,
  `canTagDimension = ADMIN || FINANCE`, que ahora gobierna los 2
  lugares de la UI de etiquetado (mostrar "Quitar" sobre una etiqueta
  existente, y mostrar el `select`+"Etiquetar" sobre una línea sin
  etiqueta) — sin tocar `canRecord`, que sigue siendo correcto para el
  resto de la pantalla (registrar/enviar/aprobar/reversar/eliminar un
  asiento).
- **Pruebas realizadas**: se invitó y activó de punta a punta un
  tercer usuario real (`f17-contador@example.com`, rol `ACCOUNTANT`)
  — con Playwright, como ese usuario, la línea ya etiquetada
  ("Ventas Generales") se mostró correctamente como un `StatusSeal`
  de solo lectura, **sin** el botón "Quitar" (antes del fix sí habría
  aparecido). No se verificó con un usuario `FINANCE` real por no
  existir uno en la empresa de prueba — la lógica es simétrica
  (`canTagDimension` cubre ambos roles con la misma condición ya usada
  en el resto del proyecto para este mismo par de roles), y
  `ADMIN` (que sí se probó de punta a punta en F17-E11-01) ya confirma
  el camino "sí puede".
- **Estado**: Corregido y verificado.

## 6. Tests

- `npm test` (backend): **708/708** pasan, sin regresión, antes y
  después de los 2 hallazgos de este bloque (se corrió 3 veces: antes
  de tocar nada, después del fix de `ledger.service.js`, y una vez más
  al cerrar el bloque).
- No se agregó ningún test unitario nuevo dedicado a los 2 hallazgos
  de este bloque — ambos son correcciones puntuales de superficie
  (una consulta de Prisma con el nombre de relación correcto, y un
  gate de rol en el frontend), verificadas con evidencia real en vivo
  (Playwright + `curl` + Postgres real) en su lugar, mismo criterio ya
  usado para hallazgos de forma equivalente en los Bloques 1 y 2 de
  este mismo F17.
- `npm run lint` (backend): limpio, 0 errores, 0 warnings.
- `npm run lint` (frontend, `oxlint`): mismo baseline de 8 warnings
  preexistentes (`only-export-components` en los 8 archivos de
  contexto ya documentados en `CLAUDE.md`), 0 warnings nuevos.
- `npm run build` (frontend): limpio, mismo warning preexistente de
  tamaño de chunk (no relacionado con este bloque).

## 7. Playwright

Evidencia real contra los dos servidores reales y Postgres real,
resumida (el detalle completo está en la Sección 4):
- E11: dimensión y presupuesto creados; línea de asiento real
  etiquetada (201) y confirmada persistida; "Quitar" (204) y volver a
  etiquetar (201) confirmados; reporte de Desviaciones con el 25% real
  visible en pantalla; verificación de permisos con un usuario
  Contador real (invitado → aceptó la invitación → vio la UI
  correctamente en modo solo lectura).
- E12: perfil y seguridad cargados con datos reales; ciclo completo de
  2FA verificado contra el backend real con códigos TOTP generados de
  verdad (no simulados).
- E13: alerta real generada por un escaneo real, visible en la campana,
  navegación y "marcar como atendida" confirmadas con respuestas HTTP
  reales (200).
- E14: análisis Vertical real ejecutado y renderizado con las 6 partes
  visibles en pantalla, capturas revisadas una por una.
- E15: exportación PDF/Excel y reporte programado corrido a mano,
  archivos reales verificados con `file`.
- 0 errores de consola nuevos en ningún flujo (el único error
  observado en cada navegación es el bloqueo ya conocido de Google
  Fonts por la política de red del entorno de pruebas, documentado
  repetidamente en `CLAUDE.md`, sin relación con este bloque).

## 8. Responsive

18 combinaciones verificadas (390 / 768 / 1440px × 6 pantallas
centrales de este bloque — Asientos Contables con la pieza nueva de
etiquetado, Mi Cuenta > Perfil, Mi Cuenta > Seguridad, FP&A >
Desviaciones, Análisis Avanzados > Repositorio, Reportes > Exportar) —
**0 desbordes horizontales** (`scrollWidth === clientWidth` exacto en
las 18), 0 errores de consola nuevos. Revisada además a mano la
captura de 390px de Asientos Contables: la columna nueva "Dimensión
FP&A" se ve y se usa correctamente dentro del patrón de scroll
horizontal que ya usa esa tabla para el resto de sus columnas en
pantallas angostas (mismo patrón ya establecido en todo el proyecto
para tablas de datos, no una regresión de esta pieza).

## 9. Auditoría

Operaciones sensibles de este bloque verificadas contra el sistema
CORE/AUDIT ya existente, sin crear ningún mecanismo nuevo:
- Invitación y activación del usuario Contador — mismo flujo ya
  auditado (`user.invitation_accepted`) que se verificó explícitamente
  en el Bloque 2 (F17-E8-01), reutilizado acá sin cambios para poder
  probar F17-E11-02 con un usuario real.
- Activar/desactivar 2FA — ya registrado por el mismo mecanismo de
  `core/account` desde que se construyó esa pieza (sin cambios de este
  bloque).
- Etiquetar/quitar una dimensión de una línea de asiento — **no
  genera una fila de auditoría propia** (`JournalEntryLineFpaDimension`
  no pasa por `core/audit`, a diferencia de crear/aprobar un asiento
  en sí) — se revisó el código del endpoint ya existente
  (`fpa-dimensions.controller.js`/`.service.js`) y se confirmó que
  esto no es nuevo de este bloque: el endpoint nunca tuvo auditoría
  propia desde que se construyó. No se consideró necesario agregarla
  en esta pieza (es una acción de clasificación analítica, de bajo
  riesgo, no un cambio de dinero ni de permiso) — documentado acá como
  observación, no como hallazgo, por si se decide agregar más
  adelante.

## 10. Regresiones

Áreas revisadas después de las modificaciones de este bloque:
- `src/core/ledger/ledger.service.js` (archivo compartido y
  sensible — el único punto de escritura de asientos de todo el
  proyecto): el cambio fue estrictamente de **lectura** (un `include`
  adicional en `getEntry`), nunca tocó `postEntry`/`submitForApproval`/
  `approveEntry`/`reverseEntry`/`deleteDraft`. `npx jest
  src/core/ledger` + la suite completa (708/708) confirman que ningún
  otro consumidor de `getEntry` (asientos de Contabilidad, los
  `journalEntryId` que usa Inventario/AR/AP/Fiscal al mostrar el
  detalle de un asiento generado por ellos) se rompió.
- `frontend/src/pages/accounting/JournalEntriesPage.jsx`: se confirmó
  que el resto de la pantalla (registrar, enviar a aprobación,
  aprobar, reversar, eliminar un asiento) sigue funcionando igual —
  ningún botón existente cambió de condición, solo se agregaron los 2
  nuevos (`canTagDimension`) sin tocar `canRecord`/`canApprove`.
- `frontend/src/api/fpa.js`: cambio puramente aditivo (2 métodos
  nuevos), sin tocar ninguno de los ya existentes — confirmado que
  `BudgetsPage`/`VariancePage`/`ScenariosPage`/`KpisPage`/
  `DimensionsPage` (los 5 consumidores previos de este archivo) no se
  vieron afectados.
- Sin incidentes de entorno en este bloque — Postgres y ambos
  servidores ya estaban arriba al reanudar el trabajo (a diferencia de
  los Bloques 1 y 2, que sí requirieron reinicio).

## 11. Deudas

- **DEUDA**: ninguna bloqueante. No quedó ningún hallazgo CRITICAL o
  HIGH sin corregir en este bloque.
- **LOW, documentada, no bloqueante**: etiquetar/quitar una dimensión
  de una línea de asiento no deja rastro en `core/audit` (ver Sección
  9) — a diferencia de prácticamente cualquier otra acción de escritura
  de este proyecto. No es un bloqueo funcional (la acción en sí
  funciona y persiste correctamente), pero una empresa que necesite
  trazabilidad completa de "quién etiquetó qué línea y cuándo" no la
  tiene todavía. Se documenta para que se considere agregarla si se
  pide.
- **FUERA DE ALCANCE**: no se construyó la UI de etiquetado en ningún
  otro lugar del proyecto además de Asientos Contables (ej. no se
  agregó un atajo para etiquetar varias líneas a la vez, ni un filtro
  "sin etiquetar" en el listado) — el alcance de este bloque era
  destrabar el flujo E11 de punta a punta, no construir todas las
  mejoras de UX posibles sobre la pieza nueva.

## 12. Decisiones arquitectónicas

- **El bug de `ledger.service.js` se corrigió en el único call site
  afectado** (el nombre de la relación en el `include` de `getEntry`),
  sin tocar ninguna otra función del motor de asientos ni la forma en
  que se escriben/validan las líneas — exactamente el tipo de cambio
  mínimo y acotado que exige el prompt de este bloque para cualquier
  modificación a Ledger/motor contable.
- **La UI de etiquetado se construyó dentro de Asientos Contables
  (Contabilidad), no dentro de FP&A** — es donde vive la línea que se
  etiqueta (una línea de un asiento ya registrado), y es la pantalla
  que ya tenía el "Ver detalle" expandible sobre el cual se podía
  colgar la columna nueva sin rediseñar nada. FP&A sigue siendo
  estrictamente de solo lectura sobre el mayor contable (regla 4 de la
  arquitectura maestra) — etiquetar una línea con una dimensión no es
  "escribir en el mayor", es clasificar una línea ya existente para
  un reporte analítico, mismo criterio que ya aplica
  `JournalEntryLineDimension` de Tesorería.
- **`canTagDimension` es una variable nueva y separada de `canRecord`**,
  no una ampliación de `canRecord` para incluir `FINANCE` — porque
  `canRecord`/`canApprove` siguen significando exactamente lo que ya
  significaban (quién puede registrar/aprobar un asiento, ADMIN/
  ACCOUNTANT) en el resto de esa misma pantalla; mezclar los dos
  conceptos en una sola variable habría sido más confuso de mantener
  que una segunda variable con su propio nombre explícito.
- **No se tocó el permiso real del backend** (`canManage =
  requireRole('ADMIN', 'FINANCE')` en `fpa-dimensions.routes.js`) para
  "arreglar" el hallazgo F17-E11-02 — el permiso del backend es
  correcto y consistente con el resto del módulo FP&A (el mismo
  `canManage` ya protege crear/editar/borrar una dimensión); lo que
  estaba mal era que el frontend no reflejaba ese permiso real, así
  que el fix fue ajustar el frontend al backend, no al revés.

## 13. Resultado final

# CERRADO

Las 5 experiencias (E11-E15) se completan de punta a punta con
evidencia real, después de una búsqueda exhaustiva que confirmó que
E11-E15 nunca estuvieron definidas para F17 en ningún lugar del
repositorio (documentado en la Sección 2, sin asumir nada en
silencio). 0 CRITICAL, 1 HIGH (corregido y verificado — la pieza de
interfaz que le faltaba al reporte de Desviaciones de FP&A para poder
mostrar un dato real alguna vez), 1 MEDIUM (corregido y verificado —
un permiso del frontend que no calzaba con el rol real exigido por el
backend, encontrado al verificar el propio fix del HIGH), 0 LOW
bloqueante (1 LOW de deuda documentada, no bloqueante), 708/708 tests,
lint y build limpios, 18/18 combinaciones responsivas sin desborde,
auditoría revisada (con una observación documentada, no un hallazgo),
sin regresiones en el motor de asientos ni en ningún otro consumidor
de los archivos tocados.

**Bloques F17 — estado consolidado**: Bloque 1 (E1-E5) CERRADO,
Bloque 2 (E6-E10) CERRADO, Bloque 3 (E11-E15) CERRADO.

Siguiente bloque: **F17 — Bloque 4 (E16–E20)** — no se empieza en esta
sesión; queda explícitamente detenido hasta que se autorice continuar.
