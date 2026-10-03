# F17 — Product Readiness — Cierre Global

## 1. Executive Summary

- **Fecha de cierre:** 2026-10-03
- **Alcance real ejecutado:** E1–E20 (Bloques 1–4). **E21–E27 (Bloque 5) nunca
  fue definido ni ejecutado** — no existe ningún reporte, código, ni
  entrada en `PROGRESS_LOG.md` que los mencione. Esto se verificó
  explícitamente antes de iniciar este cierre (ver sección 20) y se
  confirmó con el usuario, que autorizó cerrar el alcance global sobre
  E1–E20 únicamente.
- **Empresa de prueba:** `F17 Empresa Nueva` (`cmuokjy480000u8iuedegchlz`),
  creada desde cero en el Bloque 1, reutilizada sin contaminación
  através de los 4 bloques — confirmada intacta en cada retoma.
- **Resultado:** **PRODUCT READY WITH DOCUMENTED DEBT** (alcance E1–E20)
  — ver sección 21.
- **Hallazgos totales de F17 (E1–E20):** 0 CRITICAL, 10 HIGH (todos
  corregidos y verificados), 9 MEDIUM (todos corregidos y verificados),
  3 LOW (documentados, no bloqueantes), 1 DEUDA explícita (no
  bloqueante). Ver matriz completa en sección 5.
- **Baseline técnico final:** 715/715 tests backend, lint backend 0
  errores, lint frontend 8 warnings (mismo baseline preexistente desde
  antes de F17, 0 nuevos), build frontend limpio (870 módulos),
  `npx prisma validate` sin errores. **F17 no modificó el schema de
  Prisma en ningún momento de sus 4 bloques** (confirmado con `git log`:
  el último cambio a `schema.prisma` es de 2 días antes del primer
  commit de F17).

## 2. Alcance de F17

F17 — Product Readiness es una auditoría de experiencia de usuario de
punta a punta sobre el producto ya construido (Fases 1–12 previas,
documentadas en `PROGRESS_LOG.md`), ejecutada en 4 bloques de 5
experiencias cada uno (E1–E5, E6–E10, E11–E15, E16–E20), con la premisa
operativa: **"la función existe" no es lo mismo que "la experiencia
está lista"**. Cada bloque reutilizó la misma empresa de prueba,
siguiendo la narrativa de una empresa real que va madurando sus
operaciones (primer día → primeras semanas → presupuesto/seguridad →
rentabilidad/inventario avanzado). Ningún bloque introdujo
funcionalidad comercial nueva (Landing, Billing, Growth, Afiliados) —
eso está fuera de alcance de F17 por regla explícita desde el primer
bloque.

**Bloque 5 (E21–E27) no se ejecutó** en ningún momento de este
engagement — no hay definición, código, ni evidencia de que haya sido
siquiera iniciado. Este cierre global cubre por lo tanto **E1–E20**,
con E21–E27 documentado explícitamente como pendiente de definición y
ejecución fuera de F17 (sección 16, Riesgos residuales, y sección 22,
Recomendaciones).

## 3. Estado E1–E20 (E21–E27 no ejecutado)

| Bloque | Experiencias | Estado | Reporte |
|---|---|---|---|
| 1 | E1–E5 | CERRADO | `F17_PRODUCT_READINESS_E1_E5.md` |
| 2 | E6–E10 | CERRADO | `F17_PRODUCT_READINESS_E6_E10.md` |
| 3 | E11–E15 | CERRADO | `F17_PRODUCT_READINESS_E11_E15.md` |
| 4 | E16–E20 | CERRADO | `F17_PRODUCT_READINESS_E16_E20.md` |
| 5 | E21–E27 | **NO EJECUTADO** | — (no existe) |

## 4. Matriz global de experiencias (E1–E20)

| Exp. | Objetivo | Resultado | Problemas | Correcciones | Tests/Playwright | Evidencia |
|---|---|---|---:|---:|---|---|
| E1 | Primer acceso (login → Panel → navegación) | Completable | 0 bloqueos, 1 fricción | 1 (nombre de empresa en sidebar) | Playwright | `_E1_E5.md` §1 |
| E2 | Configuración de empresa (catálogo, plan de cuentas, periodo, AR/AP settings) | Completable | 3 bloqueos reales en cadena | 3 | Playwright + curl | `_E1_E5.md` §2 |
| E3 | Primera venta (Venta Rápida + Pedido→Entrega) | Completable | 3 bloqueos (Venta Rápida) | 3 | Playwright | `_E1_E5.md` §3 |
| E4 | Primera compra (proveedor→OC→recepción→factura→pago) | Completable | 0 nuevos (heredó fixes de E2/E3) | 0 | Playwright | `_E1_E5.md` §4 |
| E5 | Primer cobro/pago independientes | Completable | 0 | 0 | Playwright | `_E1_E5.md` §5 |
| E6 | Inventario en curso (transferencia, conteo físico maker-checker) | Completable | 2 reales | 2 | Jest 37/37 + Playwright 2 usuarios | `_E6_E10.md` §F17-E6-01/02 |
| E7 | Cierre de periodo y reportes financieros | Completable | 0 | 0 | Playwright | `_E6_E10.md` |
| E8 | Gestión de equipo (invitar/aceptar/menú por rol) | Completable | 2 reales (1 HIGH más importante del bloque) | 2 | Playwright, 2 usuarios reales | `_E6_E10.md` §F17-E8-01/02 |
| E9 | Cumplimiento fiscal en curso | Completable | 0 | 0 | Playwright | `_E6_E10.md` |
| E10 | Tesorería y liquidez (extracto, conciliación, previsión) | Completable | 0 | 0 | Playwright | `_E6_E10.md` |
| E11 | Presupuesto y desviaciones (FP&A) | Completable | 2 reales (1 HIGH más importante del bloque) | 2 | `curl` + Playwright | PROGRESS_LOG §F17-E11 |
| E12 | Mi Cuenta y seguridad (2FA real) | Completable | 0 | 0 | Playwright, TOTP real | PROGRESS_LOG §F17-E12 |
| E13 | Centro de Notificaciones y alertas | Completable | 0 | 0 | Playwright | PROGRESS_LOG §F17-E13 |
| E14 | Análisis Avanzados | Completable | 0 | 0 | curl + Playwright | PROGRESS_LOG §F17-E14 |
| E15 | Exportación y reportes programados | Completable | 0 | 0 | Playwright | PROGRESS_LOG §F17-E15 |
| E16 | Rentabilidad por Producto + Tablero Ejecutivo | Completable | 2 reales (1 HIGH, 1 MEDIUM) | 2 | 2 tests integración nuevos | `_E16_E20.md` §F17-E16-01/02 |
| E17 | Niveles de Acceso | Completable | 0 | 0 | Playwright | `_E16_E20.md` |
| E18 | Cobranza escalonada de AR | Completable | 0 | 0 | curl + Playwright | `_E16_E20.md` |
| E19 | Métricas del Negocio + Junta | Completable | 0 | 0 | Playwright | `_E16_E20.md` |
| E20 | Inventario Avanzado (lotes, vencimiento, reabastecimiento) | Completable | 1 real, HIGH (2 componentes) | 1 | 5 tests integración nuevos | `_E16_E20.md` §F17-E20-01 |

**Total: 20/20 experiencias completables de punta a punta con evidencia
real, 0 bloqueos abiertos.**

## 5. Defectos encontrados (matriz consolidada)

| ID | Exp. | Módulo | Severidad | Descripción | Causa |
|---|---|---|---|---|---|
| F17-E1-01..06 | E1-E3 | Config/Ventas/Nav | 3×HIGH, 2×MEDIUM, 1×LOW | Ver `_E1_E5.md` §7 — capacidades de backend completas sin interfaz (plantilla Plan de Cuentas, Ajustes AR/AP), mensajes técnicos crudos, fricción de UX | Backend completo, frontend nunca construido/pulido |
| F17-E6-01 | E6 | Inventario | MEDIUM | Botón "Aprobar" visible a quien hizo el conteo, siempre fallaba | Falta de comparación `countedByUserId !== user.id` en frontend |
| F17-E6-02 | E6 | Inventario | HIGH | Aprobar conteo fallaba 404 "sin periodo" aun con periodo abierto | Comparación de fecha con hora exacta vs. `endDate` a medianoche |
| F17-E8-01 | E8 | Auth/Access-levels | HIGH | Sin pantalla para aceptar invitación — backend completo sin UI | Mismo patrón: backend completo, frontend nunca construido |
| F17-E8-02 | E8 | Navegación | MEDIUM | Menú lateral mostraba módulos sin acceso real por rol | `NAV_AREAS` sin filtro de rol (backend sí bloqueaba, 403 real) |
| F17-E11-01 | E11 | FP&A/Contabilidad | HIGH | Sin UI para etiquetar línea de asiento con FpaDimension — Desviaciones nunca mostraba dato real | Backend completo, frontend nunca construido; bug de Prisma de paso (`getEntry` con nombre de relación incorrecto) |
| F17-E11-02 | E11 | FP&A | MEDIUM | Botón de etiquetado visible a un rol sin permiso real (403 confuso) | Frontend reutilizaba `canRecord` en vez del permiso real del backend |
| F17-E16-01 | E16 | AR/Inventory/Reports | HIGH | Rentabilidad por Producto mostraba ingreso $0 en toda venta real | Solo se etiquetaba la línea de COSTO con FpaDimension, nunca la de INGRESO |
| F17-E16-02 | E16 | Reports | MEDIUM | Tablero Ejecutivo no mostraba Utilidad del periodo | Backend correcto, frontend no renderizaba el campo |
| F17-E20-01 | E20 | Inventory | HIGH (2 componentes) | Trazabilidad de lote mostraba "0" falso; alerta de vencimiento nunca se disparaba, ambos para productos por Promedio Ponderado (el método por defecto) | Ambos servicios sumaban `StockCostLayer`, que PMP nunca crea |

**Totales:** CRITICAL=0, HIGH=10, MEDIUM=9 (incluyendo los agrupados de
E1 — ver detalle exacto en cada reporte de bloque), LOW=3 (deuda no
bloqueante: selector "desde pedido" en Facturas de Venta, plantilla de
Plan de Cuentas sin cuenta de Merma por defecto, recorte visual menor
a 390px en la tabla de Lotes). **100% de los HIGH y MEDIUM fueron
corregidos y re-verificados con evidencia real** antes de cerrar su
bloque respectivo — ninguno llegó sin resolver a este cierre global.

## 6. Defectos corregidos

Los 19 defectos HIGH+MEDIUM de la sección 5 están **todos corregidos y
verificados** (evidencia real: capturas Playwright, respuestas HTTP
con status/body, tests Jest donde aplicó). Ninguno quedó pendiente al
momento de este cierre — confirmado releyendo los 4 reportes de bloque
y re-ejecutando el baseline técnico (sección 8) sin encontrar
regresión.

## 7. Deudas aceptadas

### No bloquean Product Readiness (documentadas, no corregidas)

| Deuda | Origen | Por qué no bloquea |
|---|---|---|
| Sin selector "desde pedido" en Facturas de Venta | E3 | Venta Rápida cubre el caso de uso principal; es una capacidad adicional, no un bloqueo |
| Plantilla de Plan de Cuentas sin cuenta de Merma por defecto | E6 | Se resuelve en 1 minuto creando la cuenta a mano (ya documentado); no bloquea el flujo, solo exige un paso extra la primera vez |
| Recorte visual menor de un botón a 390px en tabla de Lotes | E20 | Confirmado clickeable pese al recorte; no impide la operación |
| Alerta de vencimiento en productos PMP es conservadora, no exacta por lote | E20 | Requeriría rediseñar el motor de valoración (capas por lote en PMP) — explícitamente fuera de alcance de F17 (regla 6: no modificar Ledger/motores financieros sin defecto que bloquee) |
| Sesiones activas sin ubicación geográfica real | Preexistente (Fase 12) | Documentado desde antes de F17 como límite consciente (no hay servicio de geolocalización) |
| Envío de correo para invitaciones/reportes programados | Preexistente | Documentado desde antes de F17 — el proyecto nunca tuvo servidor de correo saliente; los flujos son usables de punta a punta sin él (enlace copiable, descarga directa) |

**Ninguna deuda representa riesgo financiero, de pérdida de datos, ni
bloquea una capacidad crítica.** Todas son UX/alcance menor o
limitaciones de infraestructura ya conocidas y aceptadas antes de F17.

## 8. Regresión global

### Mapa de regresión (módulos tocados durante F17, por bloque)
- **Bloque 1:** navegación (AppLayout), Contabilidad (plantilla de
  cuentas), Inventario (catálogo/stock), AR (settings nuevo), Ventas
  (Venta Rápida + validator), FX/Currency context.
- **Bloque 2:** Inventario (conteos físicos + servicio), navegación
  (filtro de menú por rol), Auth (aceptar invitación), Access-levels.
- **Bloque 3:** FP&A (API client), Contabilidad (asientos + 1 línea de
  `ledger.service.js`).
- **Bloque 4:** AR (facturas), Fiscal (transacciones), Inventario
  (movimientos, alertas, trazabilidad de lotes), Reportes (tablero
  ejecutivo).

**Ningún archivo de `core/ledger`/`core/audit`/schema de Prisma fue
modificado salvo una línea de `ledger.service.js` (Bloque 3: agregar
`fpaDimensionTags` al include de `getEntry`, puramente aditivo).**
Confirmado con `git log -- prisma/schema.prisma`: sin cambios desde 2
días antes del primer commit de F17.

### Regresión ejecutada en este cierre
- Suite completa de backend corrida de nuevo tras reiniciar el entorno
  desde cero (Postgres + backend + frontend): **715/715**, idéntico al
  número reportado al cerrar el Bloque 4 — **0 drift**.
- `npx prisma validate`: sin errores.
- Integridad financiera verificada en vivo contra la empresa de
  prueba real tras las 4 rondas de operaciones de F17: `GET
  /accounting/reports/balance-sheet` → `totalAssets === totalLiabilitiesAndEquity`
  (698.08 = 698.08) — **el Ledger sigue íntegro** después de decenas de
  operaciones reales acumuladas en los 4 bloques.
- Permisos verificados en vivo con 2 usuarios reales (Administrador,
  Contador): Contador obtiene 200 en Contabilidad, 403 en Niveles de
  Acceso (sin permiso delegado) y 403 en Inventario (fuera de su
  matriz de rol) — **sin ningún 500 ni caída del servidor** (confirma
  que el bug CRITICAL de `requireAccessManagement` corregido antes de
  F17 no regresó).
- Auditoría verificada en vivo: `GET /audit-log` muestra las
  operaciones reales más recientes (recepción de orden de compra,
  movimientos de inventario, asientos contables, reglas de alerta),
  todas vía `core/audit`, sin ningún sistema paralelo.

**Resultado: sin regresiones detectadas en ningún módulo tras los 4
bloques de F17.**

## 9. Auditoría financiera

- **Ledger:** único punto de escritura de asientos
  (`core/ledger.postEntry`) — confirmado sin excepciones en los 4
  bloques (ningún código nuevo escribe `JournalEntry` por fuera de él).
- **Balance General:** cuadra exacto en la empresa de prueba tras
  todas las operaciones acumuladas de F17 (698.08 = 698.08).
- **CxC/CxP:** verificados de punta a punta en E1-E5 (factura a
  crédito → cobro independiente; factura de compra → pago parcial) y
  en E18 (cobranza escalonada con bloqueo automático de cliente
  vencido) — saldos y estados coherentes en cada verificación.
- **Inventario y costos:** FIFO/LIFO/PMP verificados correctos en E20
  (incluida la corrección de F17-E20-01); el bug de Rentabilidad por
  Producto (F17-E16-01) era de **atribución analítica** (a qué
  dimensión se etiqueta un ingreso), nunca de cálculo contable — el
  asiento de cada venta siempre fue correcto, lo que faltaba era la
  etiqueta para el reporte de rentabilidad.
- **Monedas/BCV:** sin hallazgos nuevos durante F17; las conversiones
  usadas en E5/E10 (saldos en USD, snapshot BCV en pagos) se
  comportaron según lo documentado desde antes de F17.
- **Trazabilidad:** la única corrección de este tipo
  (F17-E20-01) mejoró la honestidad de la trazabilidad de lotes sin
  tocar el cálculo de costos en sí.

**No se encontró ninguna inconsistencia financiera introducida por
F17.**

## 10. Auditoría de permisos

- Verificado en los 4 bloques que el **backend es siempre la barrera
  real** — cada hallazgo de UX relacionado con permisos (F17-E8-02,
  F17-E11-02) confirmó explícitamente que el backend YA bloqueaba
  correctamente (403) antes de corregir el frontend; ningún hallazgo
  de F17 fue un hueco de seguridad real, todos fueron de navegación
  engañosa (mostrar una opción que el servidor igual va a negar).
- Re-verificado en este cierre con usuarios reales (Administrador,
  Contador): matriz de roles (`core/rbac/module-access.js`) sigue
  aplicándose consistente en Contabilidad/Inventario/Niveles de
  Acceso, sin ningún 500 ni bypass.
- El bug CRITICAL preexistente (antes de F17) de `requireAccessManagement`
  tumbando el proceso completo ante un usuario sin permiso —
  confirmado que **no regresó** durante ningún bloque de F17 (403
  limpio en todas las pruebas, incluida la de este cierre).

## 11. Auditoría CORE/AUDIT

- **Ningún bloque de F17 creó un sistema de auditoría paralelo.** Las
  operaciones nuevas que necesitaban dejar rastro (aceptar invitación,
  aprobar conteo físico, cerrar periodo, recibir orden de compra,
  crear transacción fiscal) usan exclusivamente `core/audit.log()`,
  reutilizando acciones ya definidas o agregando nombres de acción
  coherentes con el patrón existente (`entidad.verbo`).
- Confirmado en vivo en este cierre: `GET /audit-log` muestra entradas
  reales y recientes de Inventario/Compras/Contabilidad/Alertas, todas
  con `userId` real asociado.

## 12. Auditoría de arquitectura

Aplicando la regla `¿Existe? → ¿Funciona? → ¿Reutilizar? → ¿Extender? →
¿Fusionar? → ¿Crear?` retrospectivamente sobre los 4 bloques:

- **0 modelos Prisma nuevos** (confirmado: `schema.prisma` sin tocar
  durante los 4 bloques).
- **0 APIs paralelas**: cada endpoint nuevo (`POST /auth/accept-invitation`
  ya existía; la única superficie nueva real fue el frontend que lo
  consume) extiende rutas ya existentes.
- **0 sistemas de Ledger/Audit duplicados** (confirmado con `find`:
  un solo `core/ledger`, un solo `core/audit` en todo el repositorio).
- **Patrones reutilizados explícitamente, documentados en cada
  bloque**: `resolveProductFpaDimension` (E16, reutilizado de
  Inventario en vez de duplicar la resolución de dimensión analítica),
  `canApprove`/maker-checker de Caja Chica (reutilizado el mismo
  patrón en E6 para Conteos Físicos), `moduleAccess.js` (copia
  deliberada y ya documentada del mapa de roles del backend, mismo
  patrón que `DashboardPage.jsx` usaba desde antes de F17).
- **La única duplicación real encontrada y corregida en todo F17** fue
  accidental, no arquitectónica: F17-E16-01 encontró que
  `inventory-movements.service.createExit` podía crear una
  `FpaDimension` duplicada para el mismo producto por un bug de
  aislamiento de transacción (leer con el cliente Prisma plano antes
  de la propia transacción) — corregido con `tx || prisma`, sin crear
  ninguna estructura nueva.

**Sin hallazgos de arquitectura duplicada introducida por F17.**

## 13. Responsive

| Viewport | Pantallas verificadas | Resultado |
|---|---|---|
| 390px | 25 (Bloque 1) + 41 (Bloque 2, incluye `AcceptInvitationPage`) + 18 (Bloque 3) + `/inventario/lotes` (Bloque 4) | 0 desbordes horizontales en todas |
| 768px | mismas combinaciones | 0 desbordes horizontales |
| 1024/1280/1440px (desktop/laptop) | mismas combinaciones | 0 desbordes horizontales |

Total acumulado: **más de 85 combinaciones viewport×pantalla
verificadas a lo largo de los 4 bloques**, 0 desbordes horizontales
(`scrollWidth === clientWidth` confirmado programáticamente en cada
bloque), incluida la pantalla de 390px que corresponde al bug CRITICAL
ya corregido antes de F17 (F16-E19) — sin regresión de ese fix en
ningún bloque. Único hallazgo responsive de todo F17: el recorte
visual menor de un botón en Lotes a 390px (LOW, sección 7), confirmado
clickeable pese al recorte.

## 14. Tests

| Momento | Backend | Notas |
|---|---|---|
| Antes de F17 (baseline Fase 12) | 708/708 | — |
| Cierre Bloque 1 | 707/708 | 1 flaky preexistente confirmado no relacionado (pasa 10/10 aislado) |
| Cierre Bloque 2 | 708/708 | Restaurado tras incidente de entorno, sin relación con código |
| Cierre Bloque 3 | 708/708 | 0 regresiones |
| Cierre Bloque 4 | 715/715 | +5 tests nuevos (integración, F17-E16-01 y F17-E20-01) |
| **Este cierre global (final)** | **715/715** | **0 drift respecto al cierre del Bloque 4** |

`npm run lint` backend: 0 errores en todo momento de F17.
`npx prisma validate`: sin errores en todo momento de F17.

## 15. Playwright

Cada bloque ejecutó sus 5 experiencias de punta a punta contra los dos
servidores reales y Postgres real, con capturas de pantalla en los
puntos clave — documentado en detalle en cada reporte de bloque
(secciones "Flujos ejecutados"/Playwright de cada uno). Este cierre
global **no repitió la ejecución completa de las 20 experiencias**
(regla explícita: "no reconstruir todas las experiencias desde cero
innecesariamente"), sino que:
- Confirmó el baseline técnico se mantiene idéntico (sección 14).
- Re-verificó en vivo los 3 puntos transversales de mayor riesgo
  (integridad financiera, permisos, auditoría — secciones 9-11) con
  usuarios y datos reales de la misma empresa de prueba.
- Confirmó que ningún archivo tocado por un bloque posterior rompió
  una pantalla de un bloque anterior (ej. el cambio de navegación de
  E8 sigue íntegro tras los cambios de E11/E16; el fix de fecha de E6
  sigue aplicado).

## 16. Build/Lint

| | Backend | Frontend |
|---|---|---|
| Lint | 0 errores (constante en los 4 bloques) | 8 warnings (`only-export-components`, mismo baseline desde antes de F17, 0 nuevos en ningún bloque) |
| Build | N/A (no aplica a Express) | Limpio, 870 módulos, sin errores en ningún bloque |

## 17. Errores de consola/red

A lo largo de los 4 bloques, el único error de consola recurrente
observado fue `ERR_CERT_AUTHORITY_INVALID`/bloqueo de Google Fonts —
**artefacto conocido y documentado del entorno de pruebas** (política
de red del sandbox), sin relación con la aplicación, presente desde
antes de F17. **0 errores de aplicación nuevos** (React, hidratación,
4xx/5xx inesperados) quedaron sin resolver al cierre de cada bloque —
cada uno que apareció durante las pruebas fue, o bien un hallazgo real
corregido (sección 5), o bien un error del propio script de prueba
(selectores ambiguos, documentado explícitamente en el Bloque 2 como
"no es un hallazgo del producto").

## 18. Riesgos residuales

- **Bloque 5 (E21–E27) nunca se definió ni ejecutó.** Si el plan
  maestro de F17 originalmente contemplaba estas experiencias como
  parte de Product Readiness, **quedan pendientes de definición y
  ejecución como su propio bloque** antes de considerar F17 realmente
  completo en el sentido más amplio del plan original. Este cierre
  global certifica Product Readiness **sobre E1–E20**, no sobre
  "F17 completo" si E21–E27 formaban parte de su alcance real.
- Las 4 deudas no bloqueantes de la sección 7 permanecen — ninguna
  representa riesgo financiero o de datos, pero deben revisarse en
  algún momento post-F17 (selector "desde pedido", cuenta de Merma en
  plantilla, envío de correo).
- La aproximación de la alerta de vencimiento en productos PMP
  (F17-E20-01) es conservadora, no exacta por lote — riesgo residual
  bajo (puede avisar de más, nunca de menos, pero no distingue
  múltiples lotes del mismo producto en el mismo almacén).
- El test flaky preexistente documentado en el Bloque 1
  (`sales-orders-deliveries.integration.test.js`, colisión de email en
  paralelo) sigue sin investigarse a fondo — no bloqueante (pasa
  aislado), pero pendiente.

## 19. Evidencias

Toda conclusión de este cierre está respaldada por evidencia
reproducible, documentada en:
- `F17_PRODUCT_READINESS_E1_E5.md` (Playwright + curl + capturas)
- `F17_PRODUCT_READINESS_E6_E10.md` (Playwright + Jest + curl)
- `F17_PRODUCT_READINESS_E11_E15.md` (curl + Playwright)
- `F17_PRODUCT_READINESS_E16_E20.md` (tests integración + Playwright + curl)
- `PROGRESS_LOG.md` (registro cronológico completo de los 4 bloques)
- Verificaciones en vivo de este cierre (2026-10-03): Balance General
  real (`698.08 = 698.08`), matriz de permisos con 2 usuarios reales,
  log de auditoría real, suite completa de tests (715/715), lint/build
  de ambos lados, `git log`/`find` confirmando ausencia de duplicación
  arquitectónica y de cambios al schema de Prisma.

## 20. Criterios de Product Readiness

| Criterio | Cumplido |
|---|---|
| CRITICAL = 0 | ✅ |
| HIGH = 0 abiertos | ✅ (10 encontrados, 10 corregidos) |
| Sin inconsistencia financiera conocida | ✅ (Balance cuadra, verificado en vivo) |
| Sin pérdida de datos conocida | ✅ |
| Ninguna operación crítica bloqueada | ✅ (20/20 experiencias completables) |
| Navegación coherente | ✅ (menú filtrado por rol desde E8) |
| Permisos coherentes (backend real, no solo UI) | ✅ (verificado en vivo) |
| Auditoría funcionando | ✅ (verificado en vivo, sin sistema paralelo) |
| Build estable | ✅ |
| Tests críticos estables | ✅ (715/715, 0 drift) |
| Playwright crítico estable | ✅ (evidencia de los 4 bloques + spot-check de este cierre) |
| Responsive aceptable | ✅ (85+ combinaciones, 0 desbordes; 1 recorte LOW no bloqueante) |
| Deudas restantes documentadas | ✅ (sección 7) |
| Documentación actualizada | ✅ |
| **Excepción explícita:** Bloque 5 (E21-E27) fuera de este cierre | Justificada en sección 2/18, por decisión explícita del usuario ante la contradicción detectada |

## 21. Resultado final

# PRODUCT READY WITH DOCUMENTED DEBT

**Alcance: E1–E20.** Los 4 bloques ejecutados de F17 cumplen todos los
criterios críticos de Product Readiness: 0 CRITICAL, 0 HIGH/MEDIUM
abiertos (los 19 encontrados fueron corregidos y verificados en su
propio bloque), el Ledger y la auditoría mantienen integridad real
verificada en vivo tras acumular operaciones de los 4 bloques, los
permisos son reales a nivel de backend (no solo ocultamiento de UI), y
la base técnica (tests/lint/build/responsive) es estable sin drift
desde el cierre del último bloque. Las deudas restantes (sección 7)
son de UX/alcance menor o limitaciones de infraestructura ya conocidas
desde antes de F17, ninguna bloquea una capacidad crítica ni
representa riesgo financiero o de datos.

**Bloque 5 (E21–E27) no forma parte de este resultado** — no existe,
no fue evaluado, y debe tratarse como trabajo pendiente de definir y
ejecutar por separado (ver sección 22) antes de considerar "F17
completo" en el sentido más amplio, si ese era el plan original.

## 22. Recomendaciones post-F17

1. **Decidir si Bloque 5 (E21–E27) es necesario.** Si el plan maestro
   original de F17 contemplaba 27 experiencias, falta definir y
   ejecutar las últimas 7 antes de dar por cerrado el Product
   Readiness completo. Si F17 se considera suficientemente cubierto
   con E1–E20 (las experiencias reales de una empresa operando desde
   el primer día hasta reportes/inventario avanzado), se puede dar por
   cerrado tal como está.
2. Resolver las 4 deudas documentadas (sección 7) en una sesión
   dedicada de pulido, sin prisa — ninguna es urgente.
3. Investigar el test flaky preexistente
   (`sales-orders-deliveries.integration.test.js`) para eliminarlo de
   raíz, no solo documentarlo.
4. Si se decide avanzar a una fase comercial (F18 u otra), confirmar
   primero con el usuario cuál es el plan maestro vigente — este
   cierre **no inicia ninguna fase nueva**, por instrucción explícita.
