# F17 — PRODUCT READINESS — BLOQUE 1 (E1-E5)
## Experiencia real de usuario desde cero

Pregunta que gobierna todo el bloque: **si mañana una empresa real recibe
acceso a Alarfly, ¿puede entrar, entender qué hacer, configurar su empresa
y comenzar a operar sin encontrarse con obstáculos importantes?**

Metodología: se creó una empresa nueva real (`F17 Empresa Nueva`), fuera
del `prisma/seed.js`, con un único usuario `ADMIN` recién invitado y cero
datos previos — la misma situación en la que estaría un cliente real el
primer día. Cada paso del recorrido (E1 a E5) se ejecutó con Playwright
contra los dos servidores reales y Postgres real, nunca por lectura de
código. Cada bloqueo encontrado se corrigió en el momento, siguiendo la
cadena tal como la encontraría un usuario real, y se re-verificó con una
llamada real (status + body) antes de seguir.

---

## 1. Estado de E1 — Primer Acceso

Recorrido completo: login → Panel principal → primera navegación.
Funciona sin bloqueos. Se encontró y corrigió 1 fricción de confianza: el
nombre de la empresa activa no aparecía en ningún lugar de la navegación
principal (solo en Mi Cuenta › Preferencias). Corregido — ahora se
muestra siempre en el sidebar, debajo de "Alarfly".

## 2. Estado de E2 — Configuración de Empresa

3 bloqueos reales en cadena, los 3 corregidos:
1. Catálogo de Inventario sin unidad de medida visible (panel colapsado).
2. Plan de Cuentas y Periodo Contable: sin plantilla de cuentas
   aplicable desde la interfaz (el backend ya la tenía, sin UI).
3. "Ajustes de Cuentas por Cobrar y por Pagar": la pantalla no existía en
   ningún lugar del producto, a pesar de que el propio mensaje de error
   del sistema la mencionaba por nombre.

Con los 3 corregidos, una empresa nueva puede configurarse de punta a
punta sin ayuda externa ni lectura de documentación técnica.

## 3. Estado de E3 — Primera Venta

Venta Rápida: 3 bloqueos encontrados y corregidos (almacén sin aviso,
jurisdicción fiscal con mensaje técnico crudo, cuenta de costo de venta
sin configurar con un bug real en su pantalla de configuración). Con los
3 resueltos, una venta se completa de punta a punta con un solo mensaje
de éxito claro y coherencia total entre Panel principal y Finanzas.

Venta Normal (Pedidos → Entregas): funciona de punta a punta sin ningún
bloqueo — creación, confirmación, entrega, confirmación de entrega, cada
paso con su advertencia de irreversibilidad correcta. Se documentó (sin
corregir, por estar fuera del criterio de "solo corregir bloqueos
reales") que facturar una entrega no tiene un selector "desde pedido" en
la pantalla de Facturas de Venta.

## 4. Estado de E4 — Primera Compra

Cadena completa (proveedor → orden de compra → envío → recepción →
factura desde la orden recibida → pago parcial) funcionó de punta a
punta **sin ningún bloqueo nuevo** — los 3 fixes de E2/E3 ya habían
despejado el camino (plan de cuentas, ajustes de AR/AP). Coherencia
confirmada entre Panel principal y Finanzas.

## 5. Estado de E5 — Primer Cobro / Primer Pago

Ambos flujos simulados de forma independiente (a propósito distintos de
Venta Rápida, que junta factura + cobro en un solo paso): factura de
venta a crédito → cobro posterior separado; factura de compra a crédito
→ pago parcial posterior separado (demostrado en E4). Ambos funcionan sin
bloqueos, con el ledger, la caja y los saldos de CxC/CxP actualizándose
correctamente y de forma coherente en las dos pantallas.

## 6. Flujos realmente probados de punta a punta

- Login → Panel principal → navegación por el menú lateral.
- Aplicar plantilla de Plan de Cuentas a una empresa vacía.
- Crear periodo contable.
- Crear unidad de medida, producto, cliente, proveedor, almacén.
- Configurar Ajustes de Inventario (cuenta de inventario + COGS).
- Configurar Ajustes de Cuentas por Cobrar y por Pagar.
- Registrar una entrada de inventario (stock inicial).
- Venta Rápida completa (factura + cobro en un paso).
- Pedido de venta → confirmar → entrega → confirmar entrega.
- Orden de compra → enviar → recibir → factura de compra desde la orden
  → pago parcial.
- Factura de venta a crédito → cobro independiente posterior.
- Verificación cruzada Panel principal ↔ Finanzas › Resumen en 3 puntos
  de control distintos (después de E3, E4 y E5).
- Validación responsiva en 5 anchos (1440/1280/1024/768/390px) sobre 5
  pantallas, incluidas las 4 nuevas/tocadas en este bloque.

## 7. Problemas encontrados (con severidad)

| # | Severidad | Descripción | Tipo |
|---|---|---|---|
| 1 | HIGH | Sin plantilla de Plan de Cuentas aplicable desde la UI (backend completo, sin interfaz) | BUG (capacidad existente sin exponer) |
| 2 | HIGH | Pantalla "Ajustes de Cuentas por Cobrar y por Pagar" no existía, a pesar de ser mencionada por el propio sistema | BUG (capacidad existente sin exponer) |
| 3 | HIGH | Guardado de Ajustes de Inventario se rompía por completo al dejar un campo opcional en blanco (mensaje técnico crudo) | BUG real |
| 4 | MEDIUM | Mensaje técnico crudo de Zod al facturar sin jurisdicción fiscal | BUG (violación de la regla "nunca un error técnico crudo") |
| 5 | MEDIUM | Nombre de la empresa activa ausente de la navegación principal | UX FRICTION |
| 6 | MEDIUM | Sin aviso inline de "falta almacén"/"falta cuenta de costo" antes de intentar guardar | UX FRICTION |
| 7 | LOW/DEUDA | Facturar una entrega de Pedidos/Entregas no tiene selector "desde pedido" en Facturas de Venta | MISSING CAPABILITY (no bloqueante — Venta Rápida cubre el caso principal) |

Ningún hallazgo fue una funcionalidad deliberadamente fuera de alcance
mal clasificada como bug — todos son capacidades ya construidas en el
backend sin exponer, o errores reales confirmados en vivo.

## 8. Problemas corregidos (con evidencia)

Los 6 primeros de la tabla anterior, los 6 con verificación real
(captura de pantalla + llamada HTTP con status/body confirmado):
1. Nombre de empresa en sidebar — confirmado visible en captura real.
2. Panel de unidades de medida auto-abierto — confirmado en captura.
3. Plantilla de Plan de Cuentas — POST confirmado, árbol de 30 cuentas
   visible en captura.
4. Ajustes de Cuentas por Cobrar y por Pagar — PATCH 200 confirmado,
   valores correctos releídos tras recargar.
5. Ajustes de Inventario — PATCH 200 confirmado (antes: 400 con mensaje
   técnico crudo).
6. Mensaje de jurisdicción fiscal — texto en español confirmado en
   pantalla real.

El punto 7 (selector "desde pedido") se documentó explícitamente como
deuda, no se corrigió — está fuera del criterio de "corregir bloqueos
reales" de este bloque.

## 9. Archivos modificados

- `frontend/src/context/CurrencyContext.jsx`
- `frontend/src/components/AppLayout.jsx`
- `frontend/src/components/AppLayout.css`
- `frontend/src/pages/inventory/CatalogPage.jsx`
- `frontend/src/api/accounting.js`
- `frontend/src/pages/accounting/ChartOfAccountsPage.jsx`
- `frontend/src/pages/sales/QuickSalePage.jsx`
- `src/modules/sales/validators/quick-sale.validator.js`
- `frontend/src/api/ar.js`
- `frontend/src/pages/ar-ap/ArApSettingsPage.jsx` (nuevo)
- `frontend/src/config/moduleTabs.js`
- `frontend/src/App.jsx`
- `frontend/src/pages/inventory/StockPage.jsx`
- `PROGRESS_LOG.md`
- `F17_PRODUCT_READINESS_E1_E5.md` (este documento)

## 10. Tests — antes / después

- Antes del bloque: 708/708 tests backend pasando.
- Después del bloque (corrida completa): 707/708 — 1 falla por colisión
  de `email` único en un fixture compartido de un test de integración de
  Ventas (`sales-orders-deliveries.integration.test.js`), al correr en
  paralelo con el resto de la suite. **Confirmado no relacionado con este
  bloque**: pasa 10/10 limpio al correrlo aislado; el archivo no fue
  tocado en ningún momento de este trabajo. Se documenta como flaky
  preexistente, no como regresión.
- 0 tests unitarios nuevos — todos los fixes son de UI/mensajes/payload,
  sin lógica pura nueva que amerite un test dedicado (mismo criterio ya
  usado en piezas de frontend anteriores del proyecto).

## 11. Validación con Playwright / dispositivos

Playwright contra los dos servidores reales y Postgres real, en cada
paso de E1 a E5, con capturas de pantalla en los puntos clave. Validación
responsiva: 25 combinaciones (5 anchos × 5 pantallas) — 1440, 1280, 1024,
768 y 390px (viewport móvil real) — **0 desbordes horizontales**
(`scrollWidth === clientWidth` exacto en las 25), incluida la pantalla de
390px que corresponde exactamente al escenario del bug CRITICAL ya
corregido en F16-E19. Sin regresión de ese fix.

## 12. Hallazgos CRITICAL

Ninguno. Los 3 hallazgos de mayor severidad (HIGH) fueron capacidades ya
construidas en el backend sin interfaz, nunca riesgos de seguridad,
pérdida de datos o corrupción contable — los 3 corregidos.

## 13. Hallazgos HIGH

3, los 3 corregidos (ver tabla en sección 7, filas 1-3).

## 14. Hallazgos MEDIUM

2, los 2 corregidos (ver tabla en sección 7, filas 4-6; la fila 6 agrupa
2 avisos inline del mismo tipo).

## 15. Hallazgos LOW / DEUDA

1 (ver tabla en sección 7, fila 7) — documentado, no corregido, no
bloqueante. Además: la empresa de prueba `F17 Empresa Nueva` quedó
activa en la base de datos (no se pudo borrar por completo por
relaciones sin cascada total en el grafo de claves foráneas —
`JournalEntryLineFpaDimension`, `ArPaymentApplication`, y probablemente
más en cadena); queda documentada y nombrada para que el usuario decida
si la conserva como entorno de prueba o la borra a mano.

## 16. Riesgos residuales

- El selector "desde pedido" ausente en Facturas de Venta (sección 7,
  fila 7) — riesgo de duplicar trabajo manual si un usuario usa mucho el
  flujo de Pedidos/Entregas en vez de Venta Rápida.
- La empresa de prueba activa en la base de datos de producción de este
  entorno — sin impacto funcional (aislada por `companyId` como
  cualquier otra empresa), pero ocupa espacio y aparece en listados
  administrativos globales si existieran.
- El test de integración flaky documentado en la sección 10 — no es un
  riesgo introducido por este bloque, pero sigue pendiente de
  investigación en una sesión futura (fixture con email fijo compartido
  entre archivos de test que corren en paralelo).

## 17. Qué se descartó y por qué

- **No se construyó el selector "desde pedido" en Facturas de Venta**:
  habría sido agregar una pantalla/flujo nuevo, fuera del criterio
  explícito de este bloque ("corregir bloqueos reales, nunca agregar
  funcionalidad nueva"). Documentado como deuda en su lugar.
- **No se intentó forzar el borrado en cascada completo de la empresa de
  prueba** más allá de 2 intentos — resolver el orden de borrado de
  decenas de tablas relacionadas es un trabajo de limpieza de datos, no
  una corrección de UX, y no pertenece al alcance de E1-E5.
- **No se barrieron todos los campos `.min(1)` sin mensaje personalizado
  del proyecto** — solo se corrigió `jurisdictionId`, el único
  confirmado alcanzable en vivo durante este recorrido. Barrer el resto
  sin evidencia de que son alcanzables habría sido un cambio especulativo.
- **No se tocó ningún componente de diseño, paleta, tipografía ni
  arquitectura de backend/Ledger** por razones puramente visuales — todos
  los cambios de este bloque son correcciones funcionales mínimas sobre
  el sistema de diseño ya existente.
- **No se introdujo ninguna funcionalidad comercial** (Landing, Billing,
  Trial, Afiliados, Growth) — explícitamente fuera de alcance de F17,
  igual que de F16.

---

## Estado del bloque

**BLOQUE E1-E5 CERRADO.** CRITICAL=0, HIGH=0 tras este bloque (los 3 HIGH
encontrados se corrigieron con validación real). Deuda=1, no bloqueante,
documentada. 707/708 tests (1 flaky preexistente, no relacionado).
`npm run lint` backend 0 errores; frontend mismo baseline de 8 warnings
preexistentes, 0 nuevos. `npm run build` frontend sin errores. 25/25
combinaciones responsivas sin desborde horizontal.

## DETENIDO AQUÍ — STOP OBLIGATORIO

Este bloque **no avanza a E6** sin autorización nueva y explícita del
usuario, tal como lo exige el prompt original. Se espera instrucción
para continuar con el siguiente bloque de F17 Product Readiness.
