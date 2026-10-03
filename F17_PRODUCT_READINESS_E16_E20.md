# F17 — Product Readiness — Bloque 4 (E16–E20)

## 1. Resumen ejecutivo

- **Fecha:** 2026-10-02 / 2026-10-03
- **Bloque:** F17 — Bloque 4 (E16–E20)
- **Experiencias cubiertas:** E16 (Rentabilidad y Tablero Ejecutivo), E17
  (Niveles de Acceso), E18 (Cobranza/Antigüedad de Saldos de AR), E19
  (Métricas del Negocio + Junta), E20 (Inventario Avanzado — lotes,
  vencimientos, reabastecimiento)
- **Empresa de prueba:** `F17 Empresa Nueva` (reutilizada de los
  Bloques 1–3, confirmada intacta al retomar cada vez)
- **Resultado:** **CERRADO** — ver sección 13

Se encontraron y corrigieron **3 defectos reales** (2 de severidad
HIGH, 1 de severidad MEDIUM), todos verificados contra Postgres real
con evidencia (API + Playwright), con regresión completa (715/715
tests backend, lint y build limpios en ambos lados) antes de cerrar.

## 2. Definición de E16–E20

**Búsqueda previa (regla explícita del prompt):** se revisó
`PROGRESS_LOG.md` completo, los 3 informes F17 previos
(`F17_PRODUCT_READINESS_E1_E5.md`, `_E6_E10.md`, `_E11_E15.md`) y se
buscó con `grep` cualquier aparición de "E16".."E20" en todo el
repositorio. Las únicas coincidencias pertenecen a bloques de **otros
engagements** (F14 Enterprise, F15 SaaS Readiness, F16 Growth) — temas
no relacionados con F17. **No existe un mapa maestro de experiencias
de F17** que numere E16–E20 de antemano (mismo hallazgo ya documentado
al definir E11–E15 en el Bloque 3).

Siguiendo el mismo criterio ya usado en el Bloque 3 (continuar la
narrativa de "empresa que ya opera y madura sus procesos", cubriendo
piezas construidas pero nunca ejercitadas de punta a punta como
experiencia completa), se adoptó esta definición, documentada y
ejecutada en esta sesión:

| Exp. | Objetivo | Alcance | Precondiciones | Módulos | Resultado esperado |
|---|---|---|---|---|---|
| **E16** | Un Administrador/Financiero revisa qué tan rentable es cada producto y ve un tablero ejecutivo consolidado del estado financiero | Reportes > Rentabilidad por Producto, Reportes > Tablero Ejecutivo (widget Balance General) | Ventas reales registradas, FP&A con dimensiones | `reports`, `accounts-receivable`, `inventory`, `fpa`, `accounting` | Rentabilidad muestra ingreso real por producto (no $0); Tablero muestra Activo = Pasivo + Patrimonio + Utilidad visiblemente cuadrado |
| **E17** | Un Administrador gestiona niveles de acceso: cupos por rol, usuarios, invitaciones | Niveles de Acceso (cupos, tabla de usuarios) | Usuarios ya invitados/activos de bloques previos | `access-levels`, `core/rbac` | Cupos reales por rol visibles y correctos; tabla de usuarios consistente con la base real |
| **E18** | El sistema escala la cobranza de facturas vencidas y bloquea automáticamente a un cliente con atraso grave | Cuentas por Cobrar > Cobranza escalonada (`AR_COLLECTION_ESCALATION`) | Factura vencida hace 35+ días (backdateada a propósito para la prueba) | `accounts-receivable`, `core/alerts` | Alerta CRITICAL real generada, cliente bloqueado automáticamente, visible en Centro de Notificaciones |
| **E19** | Un usuario registra una métrica de negocio manual y la sigue en el tiempo; cualquier rol manda un reporte a la Junta vía el widget del Panel | Métricas del Negocio (crear métrica, registrar valor, ver gráfico/estadísticas), widget de Junta en el Panel principal | — | `business-metrics`, `junta` | Métrica creada y graficada con datos reales; mensaje de Junta visible para el Administrador con insignia de no leídos |
| **E20** | Un usuario gestiona inventario con lotes y vencimiento: entra mercancía con lote, la vende parcialmente, rastrea el lote, el sistema avisa de stock bajo y de vencimiento próximo, y genera/recibe una orden de compra | Inventario > Lotes y Vencimientos, Movimientos (entrada/salida), Órdenes de Compra (auto-generación + recepción) | Producto con `trackLots`/`trackExpiration`, reglas de alerta `LOW_STOCK`/`PRODUCT_EXPIRING_SOON` configuradas | `inventory`, `core/alerts` | Trazabilidad de lote correcta y honesta; alerta de stock bajo genera una OC borrador; alerta de vencimiento se dispara; recepción parcial de OC funciona con discrepancia correcta |

## 3. Resultado

| Experiencia | Resultado | Bloqueos | Correcciones | Estado |
|---|---|---:|---:|---|
| E16 | Completable, con 2 defectos reales encontrados y corregidos | 0 | 2 (F17-E16-01 HIGH, F17-E16-02 MEDIUM) | ✅ Verificado |
| E17 | Completable, sin defectos | 0 | 0 | ✅ Verificado |
| E18 | Completable, sin defectos | 0 | 0 | ✅ Verificado |
| E19 | Completable, sin defectos | 0 | 0 | ✅ Verificado |
| E20 | Completable, con 1 defecto real (dos síntomas del mismo hueco arquitectónico) encontrado y corregido | 0 | 1 (F17-E20-01 HIGH, con dos componentes: trazabilidad + alerta) | ✅ Verificado |

## 4. Flujos ejecutados

### E16 — Rentabilidad y Tablero Ejecutivo
1. Se registraron ventas reales de productos físicos vía Venta
   Rápida/Facturación (reutilizando datos de bloques previos).
2. Se abrió `Reportes > Rentabilidad por Producto` — el ingreso
   mostraba **$0** para productos con ventas reales (ver Hallazgo
   F17-E16-01).
3. Tras corregir, se repitió la venta y se confirmó ingreso real
   atribuido vía `FpaDimension`.
4. Se abrió `Reportes > Tablero Ejecutivo`, widget Balance General —
   "Total Activos" no mostraba cómo cuadraba contra "Total Patrimonio"
   porque faltaba la fila de Utilidad del periodo (ver Hallazgo
   F17-E16-02). Corregido y re-verificado: Total Activos = Total
   Pasivo + Patrimonio + Utilidad, visible en pantalla.

### E17 — Niveles de Acceso
1. Login como Administrador, navegación a Niveles de Acceso.
2. Confirmadas las tarjetas de cupo por rol (`hasQuotaCards: 10`
   elementos detectados — 4 roles × ~2-3 piezas de texto por tarjeta)
   y la tabla de usuarios (`hasUsersTable: 1`) con los usuarios reales
   de bloques previos (Admin, Contador, Colaborador).
3. Sin hallazgos — el flujo ya estaba correctamente conectado desde
   construcción original (verificado también en auditoría de código:
   cupos, invitación, cambio de rol, activar/desactivar, todos
   wireados).

### E18 — Cobranza escalonada de AR
1. Se backdateó (vía script temporal de Prisma, `scripts-tmp-e18-backdate.js`,
   borrado inmediatamente después) el vencimiento de una factura real
   existente (`cmuqe19pu0027q6uvire3fntw`) a 35 días de atraso.
2. Se creó la regla `AlertRule` tipo `AR_COLLECTION_ESCALATION` (ya
   confirmado como patrón esperado: sin regla activa, el escaneo no
   genera nada — mismo criterio que `LOW_BALANCE`/`LOW_STOCK`).
3. Se disparó el escaneo — generó una alerta `CRITICAL` real
   ("Bloqueo automático: la factura 6 de 'Cliente Credito E18' lleva
   35 días vencida — el cliente quedó bloqueado para nuevas
   facturas.") y bloqueó al cliente (`Customer.isBlocked = true`).
4. Confirmado visible en el Centro de Notificaciones y en
   `GET /treasury/alerts`.

### E19 — Métricas del Negocio + Junta
1. Login, navegación a `/metricas`. Se creó/confirmó una métrica
   ("Clientes nuevos este mes") con valores registrados.
2. Se expandió el detalle — confirmado gráfico SVG (`hasChart: 7`),
   tabla de valores (`hasValueTable: 2`), y las estadísticas
   (promedio/mínimo/máximo/total — `hasPromedio: 1`).
3. Se navegó al Panel principal — confirmado el widget de Junta
   (`hasJuntaWidget: 2`) con un mensaje de prueba visible
   (`hasUnreadBadgeOrMessage: 1`).
4. Sin hallazgos.

### E20 — Inventario Avanzado (lotes, vencimiento, reabastecimiento)
1. Producto nuevo creado con `trackLots: true`, `trackExpiration: true`,
   `minStock: 20`, `maxStock: 100` (sin método de valoración propio —
   hereda el de la empresa: **Promedio Ponderado**, confirmado como el
   default real).
2. Entrada real de 50 unidades con lote "LOTE-E20-A" (vence
   2026-10-12), vía `POST /inventory/movements/entries`. Asiento
   contable generado correctamente (`journalEntryId` real).
3. Salida parcial de 15 unidades (`SALE_EXIT`). Stock bajó a 35
   correctamente.
4. `GET /inventory/lots/:id/trace` del lote — mostró
   `remainingQuantity: "0.0000"` y `usages: []`, pese a que el lote
   seguía teniendo 35 unidades reales en el almacén (ver Hallazgo
   F17-E20-01, componente A — Trazabilidad).
5. Se registró una segunda salida (16 unidades, stock a 19, por debajo
   del mínimo 20) y se crearon reglas `LOW_STOCK`/`PRODUCT_EXPIRING_SOON`.
6. `POST /inventory/purchase-orders/scan` — generó correctamente la
   alerta `LOW_STOCK` y una Orden de Compra borrador automática (81
   unidades, hasta el máximo configurado) — **sin hallazgos en esta
   parte**.
7. El mismo escaneo devolvió `expiringLots: []` pese a que el lote
   vence en 9 días y la regla tiene `daysBefore: 15` (ver Hallazgo
   F17-E20-01, componente B — Alerta de vencimiento).
8. Se corrigieron ambos componentes (mismo root cause). Re-verificado:
   trazabilidad honesta (`exactTraceAvailable: false`,
   `remainingQuantity: null`, con explicación clara) y la alerta de
   vencimiento se disparó correctamente con un mensaje honesto sobre
   la limitación de PMP.
9. Se sometió (`submit`) y se recibió parcialmente (40 de 81 unidades,
   con costo y lote nuevo "LOTE-E20-B") la Orden de Compra
   auto-generada — estado `PARTIALLY_RECEIVED`, discrepancia -41
   correcta, stock subió a 59, nuevo lote visible en Lotes y
   Vencimientos.
10. Verificación visual con Playwright en `/inventario/lotes` y
    `/inventario/compras` — pantallas correctas, sin desborde
    horizontal en 390/768/desktop.

## 5. Hallazgos

### F17-E16-01 — HIGH
- **Experiencia:** E16
- **Síntoma:** `Reportes > Rentabilidad por Producto` mostraba
  ingreso **$0** para cualquier producto con ventas reales — cualquier
  venta se veía como una pérdida del 100%.
- **Causa raíz:** El motor de Rentabilidad (`reports/profitability.service.js`)
  requiere que TANTO la línea de costo (COGS) COMO la línea de ingreso
  de una venta estén etiquetadas con la misma `FpaDimension` tipo
  `PRODUCT`. `inventory-movements.service.js` (vía
  `tagCogsLineWithProduct`) ya etiquetaba la línea de COGS desde una
  sesión anterior — pero **nada en todo el proyecto etiquetaba la
  línea de ingreso** de la factura.
- **Archivo/componente:** `src/modules/accounts-receivable/services/ar-invoices.service.js`
  (`createInvoice`), `src/modules/fiscal/services/fiscal-transactions.service.js`
  (necesitaba exponer las líneas del asiento recién creado),
  `src/modules/inventory/services/inventory-movements.service.js`
  (exportar `resolveProductFpaDimension` para reutilizarlo).
- **Corrección:** Al crear una factura de UN solo producto, se
  resuelve la misma `FpaDimension` del producto (reutilizando
  `resolveProductFpaDimension`, sin duplicar esa lógica) y se etiqueta
  la línea de ingreso real del asiento, dentro de la misma transacción.
  Deliberadamente **no** se construyó atribución para facturas con
  varios productos distintos (el motor fiscal postea un solo ingreso
  combinado por factura — arquitectura ya documentada) ni para
  Rentabilidad por Cliente (no había mecanismo de etiquetado automático
  existente que extender).
- **Tests:** 2 tests de integración nuevos en
  `ar-invoices-sales.integration.test.js` (factura de un producto SÍ
  etiqueta; factura de 2 productos NO etiqueta, evitando atribución
  ambigua).
- **Estado:** Corregido y verificado.

### F17-E16-02 — MEDIUM
- **Experiencia:** E16
- **Síntoma:** El widget "Balance General" del Tablero Ejecutivo
  mostraba Total Activos, Total Pasivos y Total Patrimonio, pero
  **nunca la Utilidad del periodo** — un usuario real veía Activos sin
  poder confirmar que cuadraban contra Pasivo+Patrimonio (que, sin la
  utilidad, parecían no cuadrar, aunque los libros SÍ estaban
  correctos).
- **Causa raíz:** El backend (`dashboard.service.js` →
  `reports.service.getBalanceSheet`) ya calculaba y devolvía
  `netIncomeToDate` correctamente — el frontend
  (`ExecutiveDashboardPage.jsx`) simplemente nunca renderizaba ese
  campo. Backend correcto, frontend incompleto (patrón ya repetido 5
  veces en este proyecto F17).
- **Archivo/componente:** `frontend/src/pages/reports/ExecutiveDashboardPage.jsx`.
- **Corrección:** Se agregaron las filas "Utilidad del periodo" y
  "Total Pasivo + Patrimonio", replicando el patrón ya usado en el
  reporte completo de Balance General (`FinancialStatementsPage.jsx`).
- **Tests:** Sin test unitario nuevo (cambio puramente de
  presentación), verificado con Playwright contra datos reales.
- **Estado:** Corregido y verificado.

### F17-E20-01 — HIGH
- **Experiencia:** E20
- **Síntoma (componente A — Trazabilidad):** `GET /inventory/lots/:id/trace`
  mostraba `remainingQuantity: "0.0000"` y `usages: []` para un lote
  que en realidad tenía 35 (luego 19) unidades reales en stock,
  vigente y próximo a vencer — un usuario real consultando la
  trazabilidad de un lote vería "0" y podría concluir erróneamente que
  ya no queda nada de ese lote, arriesgando tirar o perder de vista
  mercancía vigente.
- **Síntoma (componente B — Alerta de vencimiento):** El escaneo de
  vencimientos (`POST /inventory/purchase-orders/scan`) nunca generaba
  la alerta `PRODUCT_EXPIRING_SOON` para ese mismo lote, aunque
  vencía en 9 días y la regla configurada avisa con 15 días de
  anticipación — la alerta de seguridad nunca se disparaba, sin
  importar cuán cerca del vencimiento.
- **Causa raíz (común a ambos):** Tanto `lot-traceability.service.js`
  como `inventory-alerts.service.js` (`scanExpiringLots`) calculan
  "cuánto queda de este lote" sumando `StockCostLayer.remainingQuantity`.
  Un producto valorado por **Promedio Ponderado (PMP)** — el método
  de valoración **por defecto de la empresa** — nunca crea
  `StockCostLayer` (solo lo hacen FIFO/LIFO). La suma daba
  sistemáticamente `0`, y ambos servicios interpretaban eso como "lote
  agotado": la trazabilidad lo mostraba como 0 (dato falso) y el
  escaneo de vencimiento lo saltaba silenciosamente (`if (remaining
  <= 0) continue`) sin disparar la alerta — **sin importar el stock
  real ni la proximidad al vencimiento**. No es un caso extremo: PMP
  es el valor por defecto que hereda cualquier producto nuevo que no
  especifique su propio método.
- **Archivo/componente:**
  `src/modules/inventory/services/lot-traceability.service.js`,
  `src/modules/inventory/services/inventory-alerts.service.js`
  (`scanExpiringLots`), `frontend/src/pages/inventory/LotsPage.jsx`.
- **Corrección:** En ambos servicios se distingue explícitamente
  cuando el lote NO tiene ninguna capa de costo ligada (PMP u otro
  método sin capas). En ese caso:
  - **Trazabilidad:** en vez de reportar `0`, reporta honestamente
    `exactTraceAvailable: false` y `remainingQuantity: null`; el
    frontend muestra un aviso claro explicando la limitación (y dónde
    sí se puede ver el stock total) en vez de un número falso.
  - **Alerta de vencimiento:** en vez de saltar el lote, usa el stock
    actual del producto en el almacén donde entró como señal
    conservadora de "podría quedar algo de este lote" — prefiere
    avisar de más (con el mensaje honesto de que es aproximado) a no
    avisar nunca.

  No se tocó el motor de valoración ni `StockCostLayer` — la
  corrección es íntegramente de presentación/decisión en los dos
  servicios de lectura, consistente con la regla de no modificar
  motores financieros sin una razón que bloquee E16–E20 (este sí
  bloqueaba: un escaneo que nunca avisa es, en la práctica, una
  función rota).
- **Tests:** 2 tests de integración nuevos en
  `lot-traceability-weighted-average.integration.test.js` (PMP honesto;
  FIFO sigue exacto, sin regresión) + 3 en
  `inventory-alerts-expiring-lots.integration.test.js` (PMP sí avisa;
  PMP sin stock real no avisa — evita falso positivo; FIFO sigue
  exacto).
- **Estado:** Corregido y verificado (API real + Playwright).

## 6. Testing

### Backend
- **Total:** 715 tests, 114 suites
- **Passing:** 715/715
- **Failing:** 0
- **Skipped:** 0
- **Flaky:** 0 observados (suite corrida completa tras cada corrección)
- 5 tests nuevos en esta sesión (2 de F17-E16-01, ya contabilizados en
  una corrida previa a la compactación de contexto, dentro de los 715
  finales; 2+3=5 de F17-E20-01)

### Frontend
- `npm run lint` (oxlint): 8 warnings — mismo baseline documentado
  desde sesiones anteriores (`only-export-components` en los 8
  archivos de Context), **0 nuevos**.
- `npm run build`: limpio, 870 módulos transformados, sin errores
  (el único warning es el tamaño de chunk >500kB, preexistente y no
  relacionado).

### Playwright
- E16: verificado en sesión previa a la compactación (Rentabilidad
  mostrando ingreso real tras el fix, Tablero Ejecutivo cuadrando).
- E17: `hasQuotaCards`/`hasUsersTable` confirmados con datos reales.
- E18: alerta CRITICAL real confirmada en el Centro de Notificaciones.
- E19: métrica con gráfico/estadísticas reales, widget de Junta con
  mensaje visible.
- E20: `/inventario/lotes` — aviso honesto visible (captura
  `f17d-e20-lotes-trace.png`), sin texto falso "Cantidad restante: 0";
  `/inventario/compras` — estado "Recibida parcial" correcto (captura
  `f17d-e20-purchase-orders.png`).
- 0 errores de consola de aplicación nuevos en ninguna pantalla (el
  único error recurrente, `ERR_CERT_AUTHORITY_INVALID`/Google Fonts
  bloqueado, es un artefacto ya documentado del entorno de pruebas, no
  de la aplicación).

### Responsive
- `/inventario/lotes` (pantalla tocada en esta sesión) verificada en
  390px, 768px y desktop (1440px): **sin desborde horizontal de
  página** en ninguno (`scrollWidth <= clientWidth` confirmado por
  script en los 3 viewports).
- A 390px con un hover/flyout transitorio del menú lateral colapsado
  activo, una captura mostró el contenido parcialmente tapado — se
  confirmó que es un artefacto transitorio de interacción (flyout de
  navegación, Feature ya documentada), no un defecto persistente: una
  segunda captura con el mouse en reposo mostró el contenido legible y
  completo.
- E11–E15 (18/18 combinaciones) ya habían sido verificadas en el
  Bloque 3 y no se repitieron íntegramente aquí (regla explícita: no
  repetir trabajo cerrado), salvo la pantalla de este bloque.

## 7. Auditoría

Operaciones sensibles verificadas contra `core/audit`/mecanismos
equivalentes ya existentes, sin crear ningún sistema paralelo:
- **E18:** el bloqueo automático de cliente por cobranza escalonada
  queda registrado como alerta `CRITICAL` persistente (`core/alerts`)
  y el bloqueo en sí (`Customer.isBlocked`) es auditable vía el mismo
  mecanismo ya usado por el bloqueo manual (`blockCustomer`).
- **E20:** cada movimiento de inventario (entrada, salida, recepción
  de OC) genera su propio `JournalEntry` vía `core/ledger.postEntry`
  — el único punto de escritura de asientos del sistema — con
  `createdByUserId` real en cada `InventoryMovement`. No se requería
  auditoría adicional para las correcciones de esta sesión (son de
  solo lectura: trazabilidad y escaneo de alertas, ninguna de las dos
  escribe datos de negocio nuevos).

Sin hallazgos de auditoría faltante en este bloque.

## 8. Regresiones

- Suite completa de backend corrida **3 veces** durante esta sesión
  (antes de cada corrección confirmando el fallo esperado donde aplica,
  y después confirmando 0 regresiones): 715/715 en la corrida final.
- Se verificó explícitamente que el fix de F17-E16-01 (etiquetado de
  línea de ingreso) no afecta facturas de servicio, facturas sin
  producto, ni facturas multi-producto (test dedicado).
- Se verificó que el fix de F17-E20-01 no afecta productos FIFO/LIFO
  (ambos servicios mantienen el comportamiento exacto previo cuando sí
  existen capas de costo — confirmado con tests dedicados en los dos
  archivos nuevos).
- No se tocó ningún archivo de E1–E15; no se requirió regresión
  dirigida sobre esos bloques.
- `npx prisma validate`: sin errores (no se modificó el schema en este
  bloque).

## 9. Deudas

### LOW
- A 390px, el botón de acción de una fila de la tabla de Lotes queda
  parcialmente pegado al borde derecho de su tarjeta (visualmente
  apretado, pero confirmado clickeable) — mismo patrón de recorte
  visual ya aceptado en otras tablas del proyecto a ese ancho; no
  bloquea el uso.

### DEUDA
- La aproximación usada para la alerta de vencimiento en productos PMP
  (stock actual del almacén de entrada, no la cantidad exacta del
  lote) es conservadora pero no exacta — si un almacén tiene varios
  lotes del mismo producto venciendo en fechas distintas, la alerta no
  puede distinguir cuál de ellos específicamente tiene el stock
  restante. Documentado explícitamente en el mensaje de la propia
  alerta. Una solución exacta requeriría que PMP también llevara
  capas por lote, lo cual es un cambio de arquitectura del motor de
  valoración — fuera de alcance de F17 (regla explícita: no rediseñar
  motores financieros).

### FUERA DE ALCANCE
- No se tocó Rentabilidad por Cliente (sigue sin mecanismo de
  etiquetado automático de la línea de ingreso) — no había nada
  existente que extender sin construir una pieza nueva no pedida.
- No se agregó un modo "exacto" de trazabilidad por lote para PMP
  (requeriría rediseñar el motor de valoración).

## 10. Decisiones

1. **Definición de E16–E20 adoptada sin mapa maestro previo**,
   siguiendo el mismo criterio ya usado en el Bloque 3 (ver sección 2).
2. **F17-E20-01 se trató como un único hallazgo con dos componentes**
   (trazabilidad + alerta), no como dos hallazgos separados, porque
   comparten exactamente la misma causa raíz y la misma corrección
   conceptual (distinguir "no hay capas de costo" de "el lote está
   realmente agotado").
3. **Para la alerta de vencimiento en PMP se eligió el lado
   conservador** (avisar de más, con una aclaración honesta) en vez de
   no avisar — una alerta de seguridad que nunca se dispara es peor
   que una que avisa con una aproximación explicada.
4. **No se intentó dar trazabilidad exacta por lote a productos PMP**
   — ya era una limitación consciente documentada en el proyecto antes
   de este bloque (`CLAUDE.md`, "la trazabilidad de lotes solo es
   exacta para productos FIFO/LIFO"); esta sesión corrigió que el
   sistema MINTIERA sobre esa limitación (mostrando "0" o no avisando
   nunca) en vez de eliminar la limitación en sí, que requeriría
   rediseñar el motor de valoración (fuera de alcance explícito de
   F17, sección 6 del prompt).

## 11. Resultado final

# CERRADO

E16–E20 se pueden completar de punta a punta con datos reales, sin
bloqueos. 0 CRITICAL abiertos, 0 HIGH abiertos (los 2 HIGH encontrados
se corrigieron y verificaron en este mismo bloque), 0 MEDIUM abiertos
(el 1 MEDIUM encontrado se corrigió). Tests relevantes pasan (715/715),
Playwright confirma los flujos principales de las 5 experiencias,
build y lint limpios en ambos lados, responsive validado sin desborde,
auditoría comprobada sin huecos nuevos, sin regresiones. Documentación
y `PROGRESS_LOG.md` actualizados.
