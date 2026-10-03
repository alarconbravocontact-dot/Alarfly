# F17 — Product Readiness — Auditoría Final y Cierre Total

## 1. Resumen ejecutivo

- **Fecha de esta auditoría final:** 2026-10-03
- **Alcance verificado:** E1–E20 (4 bloques ejecutados). E21–E27 **no
  forman parte del alcance verificable de F17** — ver sección 2.
- **Empresa de prueba:** `F17 Empresa Nueva` (`cmuokjy480000u8iuedegchlz`),
  creada en el Bloque 1, reutilizada sin contaminación a través de los
  4 bloques y de esta auditoría final (confirmado con chequeos de
  integridad de datos en vivo, sección 18).
- **Trabajo de esta auditoría (no solo releer reportes anteriores):**
  se ejecutaron en vivo, contra Postgres real, dos cadenas
  transaccionales completas nuevas (una Venta → Inventario → Factura →
  CxC → Cobro → Ledger → Auditoría, una Compra → CxP → Pago → Ledger →
  Auditoría), se verificó integridad financiera a nivel de cada asiento
  individual (no solo el agregado), se auditaron datos huérfanos/
  duplicados, se re-ejecutó el baseline técnico completo desde cero
  (entorno reiniciado), y se verificó UX/responsive en pantallas no
  cubiertas específicamente por ningún bloque anterior (Panel
  principal, Finanzas, Mi Cuenta).
- **Resultado de esta auditoría: 0 defectos nuevos encontrados.** Todo
  lo verificado en profundidad (Ledger balanceado asiento por asiento,
  CxC/CxP sin desajustes, inventario sin stock negativo, sin
  FpaDimension duplicada, sin migraciones pendientes, sin tests
  deshabilitados, 0 desbordes responsive, auditoría completa en cada
  cadena) salió limpio. No fue necesario corregir nada nuevo en esta
  sesión.
- **Estado final: F17 — CLOSED WITH DOCUMENTED DEBT** (alcance E1-E20)
  — ver sección 32.

## 2. Alcance real de F17

**Búsqueda exhaustiva realizada** (no es la primera vez — ya se hizo
en el cierre global anterior y se repitió en esta sesión para no
asumir nada): `grep` de "E21" a "E27" en todo el repositorio
(`PROGRESS_LOG.md`, los 5 `F17_PRODUCT_READINESS_*.md`, `docs/`).
Resultado: **no existe ninguna definición original de E21-E27 para
F17**. Las únicas coincidencias de esos números en todo el repositorio
pertenecen a `F14 — Bloque Final (E19-E27)`, un engagement
**completamente distinto** (F14 Enterprise — intercompany,
consolidación, permisos, aprobaciones), confirmado leyendo el contexto
real de esas líneas (`PROGRESS_LOG.md` línea 6503: "## F14 — Bloque
Final (E19-E27): cierre definitivo de F14").

**Conclusión, aplicando la regla crítica de este prompt tal cual la
pide**: no existe documentación original verificable de que E21-E27
formen parte de F17. Por lo tanto, **el alcance ejecutado y auditable
de F17 termina en E20**. No se inventó ninguna experiencia artificial
para completar una numeración. Esto ya se había determinado y
consultado explícitamente con el usuario en el cierre global anterior
(quien confirmó cerrar sobre E1-E20); esta auditoría final reconfirma
la misma conclusión de forma independiente, sin asumir el resultado
anterior como verdad dada.

## 3. Estado de E1–E20

| Bloque | Experiencias | Estado verificado en esta auditoría | Regresión |
|---|---|---|---|
| 1 | E1-E5 | Sin regresión — permisos/navegación de E8 (que depende de cambios de E1) siguen correctos | ✅ |
| 2 | E6-E10 | Sin regresión — fix de fecha de conteo físico (E6) sigue aplicado, confirmado indirectamente (ningún test de inventario falla) | ✅ |
| 3 | E11-E15 | Sin regresión — `getEntry` con `fpaDimensionTags` sigue funcionando (usado indirectamente por la cadena de venta verificada en esta sesión) | ✅ |
| 4 | E16-E20 | Sin regresión — verificado EN VIVO en esta sesión: la etiqueta de ingreso (F17-E16-01) se generó correctamente en la venta nueva ejecutada; la trazabilidad honesta de lotes (F17-E20-01) sigue devolviendo `exactTraceAvailable:false` para PMP | ✅ |

**Detalle completo de las 20 experiencias** (objetivo, flujo,
hallazgos, correcciones) ya está documentado con evidencia en:
`F17_PRODUCT_READINESS_E1_E5.md`, `_E6_E10.md`, `_E11_E15.md`,
`_E16_E20.md`. No se repite aquí íntegro por regla explícita de este
prompt ("no reconstruir experiencias ya trabajadas innecesariamente");
se referencia y se verifica que sigue vigente.

## 4. Estado de E21–E27

**No existen.** Ver sección 2. No se ejecutó ningún trabajo sobre
E21-E27 porque no hay definición original verificable — crearla ahora
sería inventar experiencias, prohibido explícitamente por este mismo
prompt.

## 5. Arquitectura auditada

- **Stack confirmado sin cambios durante F17**: Node/Express CommonJS,
  Prisma/PostgreSQL, Zod, JWT/bcryptjs, React/Vite — tal como
  documenta `CLAUDE.md`.
- **Prisma schema: 0 cambios en los 4 bloques de F17** (confirmado con
  `git log -- prisma/schema.prisma`: último cambio 2 días antes del
  primer commit de F17). **47 migraciones aplicadas, base de datos al
  día** (`npx prisma migrate status` → "Database schema is up to
  date!", verificado en esta sesión).
- **Un solo `core/ledger`, un solo `core/audit`** en todo el
  repositorio (confirmado con `find`) — sin sistemas paralelos.
- **Archivos con nombre repetido, verificados caso por caso**:
  `alerts.service.js` (Tesorería, 267 líneas) y `consolidation.service.js`
  (Reportes, 14 líneas) — ambos son **envoltorios delgados ya
  documentados desde antes de F17** (reexportan/envuelven el servicio
  real de `core/alerts`/`accounting`, respectivamente), no
  implementaciones paralelas. Confirmado con el tamaño de archivo
  (14 líneas no puede ser una reimplementación).
- **0 duplicación arquitectónica introducida por F17.** La única
  duplicación real encontrada en los 4 bloques fue un bug transitorio
  (F17-E16-01, segunda parte): una `FpaDimension` que podía duplicarse
  por un fallo de aislamiento de transacción, ya corregido y
  reverificado en esta sesión (0 nombres de dimensión duplicados en la
  empresa de prueba).
- **3 marcadores TODO/FIXME/HACK** en todo `src/` (fuera de tests) —
  ninguno introducido por F17 (no se tocó ningún archivo que los
  contenga durante los 4 bloques).

## 6. Módulos auditados

Los 9 módulos de negocio (`accounting`, `treasury`,
`accounts-receivable`, `accounts-payable`, `inventory`, `fiscal`,
`fpa`, `reports`, `sales`) más los núcleos compartidos
(`core/ledger`, `core/audit`, `core/rbac`, `core/alerts`,
`core/period-lock`, `core/fx`) fueron ejercitados con datos reales en
algún punto de los 4 bloques de F17 o en esta auditoría final. Ningún
módulo quedó sin tocar. Access-levels, Junta, Mi Cuenta y Métricas del
Negocio (núcleos de usuario/empresa) también se ejercitaron
(E8, E12, E17, E19).

## 7. Integraciones (cadenas completas verificadas en vivo en esta sesión)

### Cadena de Venta: Venta → Inventario → Factura → CxC → Cobro → Ledger → Auditoría
Ejecutada en vivo contra Postgres real en esta auditoría (Venta
Rápida real, factura `cmushw9fw000p52r6tldl51ju`, $30, producto físico):
1. **Inventario**: stock de "Producto Demo" en Almacén Principal bajó
   de 98 a 96 (exacto, -2 unidades vendidas).
2. **Factura/CxC**: `totalAmount: 30, paidAmount: 15, status:
   PARTIALLY_PAID` tras un cobro parcial de $15 — coherente.
3. **Ledger**: 2 asientos generados, ambos balanceados exactos
   (19.32=19.32 la venta con costo de inventario incluido; 15=15 el
   cobro), ambos `APPROVED`.
4. **Auditoría**: 6 eventos en orden cronológico correcto —
   `fiscal_transaction.created` → `journal_entry.created` (venta) →
   `inventory_movement.exit_created` → `ar_invoice.created` →
   `journal_entry.created` (cobro) → `ar_payment.recorded`.

### Cadena de Compra: Compra → CxP → Pago → Ledger → Auditoría
Ejecutada en vivo en esta auditoría (factura de compra de servicio
`cmushwwwh002e52r6boikuxrz`, $40, pago completo inmediato):
1. **CxP**: `status: PAID, paidAmount: 40` tras el pago.
2. **Ledger**: asiento del pago balanceado exacto (40=40), `APPROVED`.
3. **Tesorería**: "Banco Principal" bajó de 95 (tras el cobro de la
   cadena de Venta, 80+15) a 55 (-40 del pago) — saldo exacto,
   consistente entre las dos cadenas ejecutadas en la misma sesión.
4. **Auditoría**: 4 eventos correctos — `fiscal_transaction.created` →
   `ap_bill.created` → `journal_entry.created` → `ap_payment.recorded`.

### Cadena de Inventario avanzado (verificada en el Bloque 4, reconfirmada)
Movimiento → Existencia → Trazabilidad: entrada de lote con
vencimiento → salida parcial → `GET /inventory/lots/:id/trace`
reportando honestamente la limitación de PMP (post-fix de
F17-E20-01) en vez de un "0" falso.

### Conclusión
Las cadenas transversales pedidas explícitamente por este prompt
**funcionan de punta a punta, con datos 100% reales generados en esta
misma sesión**, no solo releídos de reportes anteriores.

## 8. Finanzas

- **Balance General**: `totalAssets === totalLiabilitiesAndEquity`
  verificado DOS VECES en esta sesión (antes y después de las 2 nuevas
  cadenas transaccionales ejecutadas) — 698.08=698.08 antes, 668.76=668.76
  después (la diferencia de 29.32 es exactamente el efecto neto
  esperado de las nuevas operaciones: +30 ingreso -19.32 costo -40
  gasto = -29.32... verificado coherente con el resultado del
  ejercicio).
- **Cada asiento individual de la empresa de prueba está balanceado**:
  23 asientos preexistentes + 4 nuevos de esta sesión, **0
  desbalanceados** (chequeo exhaustivo línea por línea contra
  Postgres, no solo el agregado del Balance General).
- **CxC**: 6+1 facturas (la nueva de esta sesión), **0 desajustes**
  entre `paidAmount` y la suma real de `ArPaymentApplication` — ni una
  sola factura con el monto aplicado distinto del monto marcado como
  pagado. 0 facturas sobre-pagadas.
- **CxP**: 1+1 facturas, **0 desajustes** del mismo tipo.
- **Monedas/BCV**: sin cambios ni hallazgos nuevos — el mecanismo de
  snapshot BCV en pagos (documentado y probado en bloques anteriores)
  no fue tocado por ningún fix de F17.

**Sin inconsistencias financieras, sin duplicación de movimientos, sin
reversos incorrectos, sin diferencias entre frontend y backend
encontradas.**

## 9. Inventario

- **0 niveles de stock negativos** en toda la empresa de prueba
  (chequeo exhaustivo contra Postgres).
- **0 líneas de orden de compra sobre-recibidas**
  (`quantityReceived > quantityOrdered`).
- Movimientos de entrada/salida/ajuste/transferencia verificados con
  asientos correctos donde corresponde (entrada/salida sí generan
  asiento; transferencia no, por diseño ya documentado).
- El hallazgo real de F17 en esta área (F17-E20-01: trazabilidad de
  lote y alerta de vencimiento mintiendo "0"/nunca disparando para
  productos PMP) está corregido y reverificado en esta sesión —
  sigue devolviendo la respuesta honesta.

## 10. Ventas

Venta Rápida (factura+cobro en un paso) y Pedido→Entrega→Factura
verificados funcionando de punta a punta — la cadena nueva ejecutada
en esta sesión (sección 7) usó Venta Rápida con producto físico, costo
real de inventario (FIFO: $9.65812/unidad, consistente con las capas
existentes), impuesto resuelto por jurisdicción fiscal, y cobro
parcial aplicado correctamente.

## 11. Compras

Factura de compra directa + pago verificados en esta sesión
funcionando de punta a punta (sección 7). Orden de Compra → envío →
recepción (parcial y total) ya verificados en bloques anteriores
(E4, E20) y en esta sesión se confirmó que no hay líneas
sobre-recibidas en ningún registro de la empresa.

## 12. Maestros

Productos/variantes, categorías, unidades de medida, clientes,
proveedores, monedas (USD base, BCV configurado), dimensiones
(`FpaDimension` tipo PRODUCT/CLIENT) — todos ejercitados con datos
reales a través de los 4 bloques. 3 productos, 2 clientes, 1 proveedor
reales en la empresa de prueba al momento de este cierre, todos con
relaciones correctas (confirmado sin huérfanos en la sección 18).

## 13. Configuración

Plan de Cuentas (plantilla aplicada en E2), Periodo Contable (creado/
cerrado/reabierto en E2/E7), Ajustes de Inventario (cuenta de
inventario/COGS/merma configuradas en E1/E6), Ajustes de Cuentas por
Cobrar y por Pagar (E2), Perfil de Empresa (RIF pendiente — visible
honestamente en la barra de progreso del Panel principal, sección 19),
Niveles de Acceso/cupos por rol (E17) — toda configuración usada por
el sistema existe, se guarda y tiene efecto real, verificado en cada
bloque con evidencia.

## 14. Permisos

Verificado en vivo en esta sesión con 2 usuarios reales:
- **Administrador**: acceso total confirmado.
- **Contador** (`f17-contador@example.com`, rol `ACCOUNTANT`): `200`
  en Contabilidad (dentro de su matriz de rol), `403` en Niveles de
  Acceso (`"Solo el Administrador puede entrar..."`, sin permiso
  delegado activo), `403` en Inventario (fuera de su matriz) — **los 3
  resultados exactamente los esperados según `core/rbac/module-access.js`**,
  y **sin ningún 500** (confirma que el bug CRITICAL preexistente de
  `requireAccessManagement` tumbando el servidor, corregido antes de
  F17, no regresó en ningún bloque).
- Colaborador (rol `COLLABORATOR`) verificado extensamente con
  Playwright real en el Bloque 2 (E8): menú filtrado correctamente,
  backend confirmado como la barrera real (403 en los 4 intentos
  directos por URL probados, no solo el frontend ocultando botones) —
  no repetido en esta sesión por ya tener evidencia reciente y
  suficiente (regla: no duplicar cobertura innecesariamente).

**Las APIs están protegidas de verdad, no solo la UI** — confirmado
en los 4 bloques y reconfirmado en esta sesión.

## 15. CORE

`core/ledger`, `core/audit`, `core/rbac`, `core/alerts`,
`core/period-lock`, `core/fx`, `core/account` — todos reutilizados sin
excepción por los fixes de los 4 bloques de F17. Ningún fix de F17
creó un servicio `core/*` nuevo ni modificó la lógica interna de
ninguno de ellos salvo una línea aditiva en `core/ledger/ledger.service.js`
(Bloque 3: agregar `fpaDimensionTags` al `include` de `getEntry`).

## 16. AUDIT

Confirmado en vivo en esta sesión: las 2 cadenas transaccionales
nuevas generaron exactamente los eventos de auditoría esperados (10
eventos en total entre las dos), todos vía `core/audit.log()`, en el
orden cronológico correcto, con `userId` real en cada uno. **0
sistemas de auditoría paralelos** en todo el proyecto.

## 17. Ledger

**Único punto de escritura de asientos** (`core/ledger.postEntry`),
confirmado sin excepciones en el código tocado por F17. Integridad
verificada a nivel de **cada asiento individual** de la empresa de
prueba completa (27 asientos tras esta sesión), no solo el agregado
del Balance General: **0 asientos desbalanceados**. Esta es la
verificación financiera más rigurosa hecha en todo F17 — las
auditorías de cada bloque solo habían verificado el Balance General
agregado; esta auditoría final bajó al nivel de línea de asiento.

## 18. Datos

- **Migraciones**: 47 aplicadas, base de datos al día, sin pendientes.
- **FKs/constraints**: sin cambios de schema durante F17, por lo tanto
  sin riesgo de constraint nuevo mal definido.
- **Datos huérfanos/duplicados**: 0 `FpaDimension` tipo PRODUCT
  duplicadas por nombre; 0 desajustes CxC/CxP; 0 stock negativo; 0
  sobre-recepción de OC — todos verificados con consultas directas
  contra Postgres en esta sesión, no solo inferidos.
- **Empresa de prueba activa en la base de datos**: documentada desde
  el Bloque 1 como deuda LOW (no se pudo borrar por completo por
  relaciones en cadena) — sigue así, sin impacto funcional (aislada
  por `companyId` como cualquier empresa real), confirmado que **no
  representa un problema de producto**, solo de limpieza de datos de
  prueba.

## 19. UX

Verificado en esta sesión con Playwright en 3 pantallas no cubiertas
específicamente por ningún bloque anterior (Panel principal, Finanzas,
Mi Cuenta), además de toda la evidencia ya documentada por bloque:
- **Panel principal**: totalmente funcional y coherente con los datos
  reales — 6 tarjetas de KPI (Caja disponible, CxC vencidas, CxP
  próximas, EBITDA, Burn rate, Runway), feed "Requiere tu atención"
  con 6 alertas reales y específicas (incluida la alerta de
  vencimiento de lote con el mensaje honesto corregido en F17-E20-01),
  acciones rápidas, gráficos de evolución, Previsión de Liquidez,
  widget de Junta — sin ningún elemento roto, sin "undefined", sin
  placeholders fantasma.
- **Sin pantallas que prometan capacidades inexistentes, sin botones
  sin acción, sin loading infinito** en ninguna de las 3 pantallas
  verificadas.
- El resto de la superficie de UX (las 20 experiencias) ya está
  auditado con evidencia extensa en los 4 reportes de bloque — no se
  repite.

## 20. Responsive

Verificado en esta sesión (390px y desktop) en Panel principal,
Finanzas y Mi Cuenta: **0 desbordes horizontales** en las 6
combinaciones. Sumado a las 85+ combinaciones ya verificadas en los 4
bloques (secciones de cada reporte), **ninguna regresión responsive**
en todo F17. Único hallazgo responsive de todo el proyecto: recorte
visual menor de un botón en Lotes a 390px (LOW, ya documentado,
confirmado clickeable).

## 21. APIs

Las APIs ejercitadas en esta sesión funcionaron exactamente según su
contrato documentado: `POST /sales/quick-sale`, `POST
/accounts-payable/bills`, `POST /accounts-payable/payments`, `GET
/accounting/reports/balance-sheet`, `GET /audit-log` (nota: esta ruta
vive en `/audit-log`, neutral, desde la Fase 11 — varios reportes de
bloque la referencian bajo `/accounting/audit-log`, una desalineación
de documentación menor, no un bug de la API en sí, ya corregida en el
cierre global anterior). Ningún endpoint devolvió un error inesperado
en toda la sesión.

## 22. Código

Sin cambios de código en esta auditoría final — **0 defectos nuevos
encontrados** que requirieran corrección (ver sección 26). El código
tocado por los 4 bloques de F17 (listado completo en cada reporte de
bloque) permanece intacto y funcionando, confirmado por la regresión
de esta sesión.

## 23. Tests

| Momento | Backend |
|---|---|
| Baseline antes de F17 | 708/708 |
| Cierre Bloque 4 | 715/715 |
| **Esta auditoría final (entorno reiniciado desde cero)** | **715/715** |

- **0 tests deshabilitados** (`grep` de `.skip`/`xdescribe`/`xit` en
  todo `src/` fuera de tests: 5 coincidencias, las 5 confirmadas como
  falsos positivos — texto `createExit`, no `.skip`).
- **0 tests modificados para forzar un verde** en esta sesión (no se
  tocó ningún archivo de test).
- Test flaky preexistente (`sales-orders-deliveries.integration.test.js`,
  colisión de email bajo ejecución en paralelo, documentado desde el
  Bloque 1): reconfirmado en esta sesión que pasa limpio aislado
  (10/10) y que la suite completa pasó 715/715 junta en esta corrida —
  no se manifestó en esta sesión.
- `npm run lint` backend: 0 errores. `npx prisma validate`: sin
  errores. `npx prisma migrate status`: al día, sin pendientes.

## 24. Playwright

Esta auditoría final ejecutó Playwright real contra los dos
servidores y Postgres real en 3 pantallas adicionales (Panel
principal, Finanzas, Mi Cuenta), sumado a toda la cobertura ya
documentada por los 4 bloques (decenas de flujos completos con
capturas, 2 usuarios reales invitados/activados, 2FA real con TOTP,
etc. — detallado en cada reporte de bloque). No se repitió la
ejecución completa de las 20 experiencias (regla: reutilizar,
no duplicar innecesariamente) — se verificaron en su lugar, vía API
directa, los puntos de mayor riesgo (cadenas financieras completas,
sección 7).

## 25. Build/Lint

| | Backend | Frontend |
|---|---|---|
| Lint | 0 errores | 8 warnings (`only-export-components`, baseline desde antes de F17, 0 nuevos) |
| Build | N/A | Limpio, 870 módulos, sin errores |

Ambos re-ejecutados desde cero en esta sesión, resultado idéntico al
del cierre del Bloque 4 — sin drift.

## 26. Defectos encontrados (en esta auditoría final)

**0 nuevos.** Todo lo auditado en profundidad en esta sesión
(integridad financiera asiento-por-asiento, CxC/CxP, inventario,
datos huérfanos, migraciones, permisos, auditoría, UX de pantallas no
cubiertas, responsive, tests/lint/build) salió limpio.

Para el registro histórico completo de los 19 defectos encontrados y
corregidos a lo largo de los 4 bloques de F17 (10 HIGH, 9 MEDIUM, 0
CRITICAL), ver la matriz consolidada ya construida en el cierre global
anterior (este mismo archivo, versión previa, conservada en el
historial de `PROGRESS_LOG.md`) y el detalle en cada reporte de
bloque.

## 27. Defectos corregidos

Los 19 defectos de los 4 bloques siguen corregidos y **reverificados
sin regresión** en esta sesión (sección 3). 0 defectos nuevos que
corregir en esta auditoría final.

## 28. Deudas restantes

| Deuda | Severidad | Impacto | Por qué no bloquea | Prioridad futura |
|---|---|---|---|---|
| Sin selector "desde pedido" en Facturas de Venta | LOW | Un usuario que prefiera el flujo Pedidos/Entregas debe duplicar trabajo manual al facturar | Venta Rápida cubre el caso principal | Baja |
| Plantilla de Plan de Cuentas sin cuenta de Merma por defecto | LOW | Primer conteo físico con diferencia real exige crear la cuenta a mano | Se resuelve en 1 paso, ya documentado | Baja |
| Recorte visual menor de un botón a 390px en Lotes | LOW | Puramente estético | Confirmado clickeable | Baja |
| Alerta de vencimiento en productos PMP es conservadora, no exacta por lote | DEUDA | Puede avisar de más (nunca de menos) cuando hay varios lotes del mismo producto en el mismo almacén | Requeriría rediseñar el motor de valoración (capas por lote en PMP) — fuera de alcance de F17 por regla explícita | Media (evaluar si se pide una mejora futura) |
| Test flaky bajo ejecución en paralelo (`sales-orders-deliveries.integration.test.js`) | LOW | Puede fallar ocasionalmente en CI bajo paralelismo, nunca aislado | No bloquea ningún flujo de producto, es un problema de fixture de test | Baja |
| Empresa de prueba sin poder borrarse en cascada completa | LOW (datos de prueba, no producto) | Ocupa espacio en la base de datos | Aislada por `companyId`, sin impacto funcional | Baja |
| Sin envío de correo real (invitaciones, reportes programados) | FUERA DE ALCANCE (preexistente) | Flujos usables de punta a punta sin él (enlace copiable, descarga directa) | Documentado desde antes de F17, nunca hubo servidor de correo saliente | A decidir por el usuario |

**Ninguna deuda es CRITICAL, HIGH, ni representa riesgo financiero, de
datos, o bloquea una operación principal.**

## 29. Riesgos residuales

1. **E21-E27 no definidos**: si el plan maestro original de F17
   contemplaba 27 experiencias, 7 quedan sin auditar. Esto es un riesgo
   de alcance, no un riesgo de calidad del producto auditado.
2. La aproximación conservadora de la alerta de vencimiento en PMP
   (sección 28) podría, en una empresa con múltiples lotes del mismo
   producto en el mismo almacén, generar una alerta sin poder indicar
   cuál lote específico está por vencer — riesgo bajo, mitigado por
   ser conservador (avisa de más, nunca de menos).
3. El test flaky bajo paralelismo podría generar una falsa alarma en
   una corrida de CI futura — riesgo bajo, ya caracterizado y con
   workaround conocido (correr aislado).

Ningún riesgo residual es CRITICAL ni HIGH.

## 30. Regresión final

Ejecutada en esta sesión, con el entorno reiniciado completamente
desde cero (Postgres + backend + frontend):
- **715/715 tests backend** — idéntico al cierre del Bloque 4, 0 drift.
- **Lint/build limpios en ambos lados** — idéntico, 0 drift.
- **Cadena de Venta completa** (Inventario→Factura→CxC→Cobro→Ledger→
  Auditoría) ejecutada en vivo — funciona correctamente.
- **Cadena de Compra completa** (CxP→Pago→Ledger→Auditoría) ejecutada
  en vivo — funciona correctamente.
- **Integridad financiera verificada a nivel de cada asiento** (no
  solo agregado) — 0 desbalanceados en 27 asientos reales.
- **Permisos verificados en vivo** con 2 usuarios reales — sin
  regresión del bug CRITICAL preexistente ya corregido.
- **UX/responsive verificado** en 3 pantallas adicionales — sin
  hallazgos.

**Conclusión: sin regresiones en ningún módulo, en ningún bloque, en
esta auditoría final.**

## 31. Evidencias

- Los 4 reportes de bloque (`F17_PRODUCT_READINESS_E1_E5.md`,
  `_E6_E10.md`, `_E11_E15.md`, `_E16_E20.md`) — evidencia Playwright +
  curl + Jest de las 20 experiencias.
- `PROGRESS_LOG.md` — registro cronológico completo, histórico
  conservado.
- **Evidencia nueva de esta auditoría final** (2026-10-03): factura de
  venta real `cmushw9fw000p52r6tldl51ju` ($30, con cobro parcial $15,
  2 asientos balanceados, 6 eventos de auditoría); factura de compra
  real `cmushwwwh002e52r6boikuxrz` ($40, pago completo, 1 asiento
  balanceado, 4 eventos de auditoría); Balance General antes/después
  (698.08→668.76, ambos cuadrando exacto); 0 asientos desbalanceados
  en 27 reales; 0 desajustes CxC/CxP en 7 facturas reales; 0 stock
  negativo; 0 FpaDimension duplicada; permisos de Contador verificados
  (200/403/403); captura de pantalla del Panel principal
  (`final-dashboard-desktop.png`) confirmando UX íntegra; 715/715
  tests, lint/build limpios, 47 migraciones al día.

## 32. Estado final de F17

# F17 — CLOSED WITH DOCUMENTED DEBT

**Alcance: E1–E20** (E21-E27 no forman parte de la documentación
original verificable de F17 — sección 2). Las 20 experiencias
ejecutadas están completas, sin CRITICAL ni HIGH abiertos, con
regresión limpia confirmada en esta auditoría final mediante cadenas
transaccionales reales ejecutadas en vivo (no solo releídas de
reportes previos). La integridad financiera del Ledger se verificó al
nivel más riguroso posible en este cierre (asiento por asiento, 0
desbalanceados), los permisos son reales a nivel de API, la auditoría
funciona sin sistemas paralelos, y las deudas restantes (sección 28)
son todas de severidad LOW o explícitamente fuera de alcance, ninguna
bloquea Product Readiness.

F17 termina aquí. No se inicia ninguna fase posterior (F18, landing,
comercialización, afiliados) — por instrucción explícita de este
cierre.
