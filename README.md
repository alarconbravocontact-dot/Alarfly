# Alarfly

Plataforma de gestión financiera integral para empresas físicas y digitales
(pequeñas, medianas y grandes). Un solo sistema para contabilidad, tesorería,
cuentas por cobrar y por pagar, inventario, impuestos, planificación
financiera y reportes — todo conectado entre sí.

## Documentación del proyecto

- [`docs/ARQUITECTURA_MAESTRA.md`](docs/ARQUITECTURA_MAESTRA.md) — el plano
  general: el core compartido, cómo se comunican los módulos y el orden de
  construcción.
- [`CLAUDE.md`](CLAUDE.md) — la bitácora viva: qué se ha construido en cada
  módulo y las decisiones tomadas en el camino.

## Tecnología

- Node.js + Express (servidor y API)
- PostgreSQL + Prisma (base de datos y ORM)
- Zod (validación de datos)
- JWT (autenticación de usuarios)
- React + Vite (frontend, ver `frontend/README.md`)

## Estructura del proyecto

```
src/
  core/              # Lo compartido por todos los módulos: config, base de
                      # datos, eventos, autenticación, utilidades.
  modules/
    accounting/           # Contabilidad
    treasury/              # Tesorería (en desarrollo)
    accounts-receivable/   # Cuentas por Cobrar
    accounts-payable/      # Cuentas por Pagar
    inventory/              # Inventario
    fiscal/                  # Fiscal
    fpa/                      # FP&A (Planificación y Análisis Financiero)
    reports/                   # Reportes
  app.js             # Configuración de la aplicación Express
  server.js          # Punto de arranque del servidor
prisma/
  schema.prisma      # Modelos de la base de datos
frontend/
  src/               # Panel web (React) — ver frontend/README.md
```

## Puesta en marcha (entorno local)

1. Instalar dependencias:
   ```
   npm install
   ```
2. Copiar `.env.example` a `.env` y completar los valores (conexión a la
   base de datos y clave para JWT):
   ```
   cp .env.example .env
   ```
3. Aplicar el esquema a la base de datos:
   ```
   npx prisma migrate dev
   ```
4. Cargar datos de prueba (empresa, usuarios y plan de cuentas de ejemplo):
   ```
   npm run prisma:seed
   ```
5. Ejecutar en modo desarrollo:
   ```
   npm run dev
   ```
6. Verificar que el servidor responde en `http://localhost:3000/health`.

## Scripts disponibles

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta el servidor en modo desarrollo (se reinicia solo al guardar cambios). |
| `npm start` | Levanta el servidor en modo normal. |
| `npm run lint` | Revisa el código en busca de errores comunes. |
| `npm run format` | Da formato automático al código. |
| `npm test` | Corre los tests unitarios. |
| `npm run prisma:generate` | Genera el cliente de base de datos a partir de `prisma/schema.prisma`. |
| `npm run prisma:migrate` | Aplica los cambios del esquema a la base de datos. |
| `npm run prisma:seed` | Carga una empresa, usuarios y un plan de cuentas de ejemplo. |

## Módulo de Contabilidad

Completo: Plan de Cuentas jerárquico y multidimensional, Motor de
Asientos (partida doble, flujo de aprobación, reversos), Libro Mayor y
Estados Financieros, Cierre de Periodo y Auditoría, Multi-moneda y
Diferencial Cambiario, Activos Fijos con depreciación automática, y
Consolidación Multi-empresa.

Después de correr el seed, puedes iniciar sesión con:

| Usuario | Rol | Contraseña |
|---|---|---|
| admin@demo.alarfly.com | ADMIN | Demo1234! |
| contador@demo.alarfly.com | ACCOUNTANT | Demo1234! |
| aprobador@demo.alarfly.com | APPROVER | Demo1234! |

`POST /auth/login` devuelve un token que se envía en cada petición como
`Authorization: Bearer <token>`.

## Módulo de Tesorería

Completo, salvo un punto bloqueado: Cuentas Bancarias y Tarjetas (con
posición de caja consolidada y colchón de liquidez), Feeds Bancarios
(importación CSV/OFX/MT940), Motor de Conciliación Bancaria (automático
+ manual, genera el asiento contable si falta), Conciliación de
Tarjetas de Crédito (con cruce a caja chica), Órdenes de Pago y Lotes
con aprobación multinivel (maker-checker, exportación a CSV genérico),
Gestión de Deuda y Líneas de Crédito (préstamos con cronograma de
cuotas, líneas de crédito), Caja Chica y Legalización de Gastos
(maker-checker), y Motor de Alertas (saldo bajo, tarjeta cerca del
límite, pagos próximos a vencer). La Previsión de Liquidez queda
pendiente hasta que existan los módulos de Cuentas por Cobrar/Pagar.
Cada importación crea una cuenta de ejemplo "Banco Principal" al correr el
seed (`npm run prisma:seed`).

## Módulo de FP&A y Control de Gestión

Completo: Dimensiones Analíticas Jerárquicas (departamentos/líneas de
negocio en varios niveles, sin código, etiquetables sobre cualquier
línea de un asiento contable), Presupuestos Versionados (por año
fiscal, versiones ORIGINAL y REFORECAST, flujo borrador → revisión →
aprobado, con reparto por fórmula/driver), Análisis de Desviaciones en
Tiempo Real (presupuesto vs. real por dimensión, con justificación
obligatoria cuando se supera el umbral configurado), Simulador de
Escenarios "What-If" (nunca escribe datos reales; solo calcula y,
si se pide, guarda el escenario como referencia — conectado con la
Previsión de Liquidez real de Tesorería, así que el impacto del
escenario se ve semana a semana sobre el saldo de caja real, no una
aproximación), y Tablero de KPIs
(EBITDA, Burn Rate, Runway, y KPIs personalizados con fórmulas propias
sobre cuentas contables). Rutas bajo `/fpa/dimensions/*`,
`/fpa/budgets/*`, `/fpa/variance/*`, `/fpa/scenarios/*` y `/fpa/kpis/*`.

## Frontend (panel web)

Construido con React + Vite. **Completo: los 9 módulos del backend ya
tienen su pantalla.** Pantalla de Acceso, Panel principal (con KPIs
reales del backend, un gráfico de ingresos/egresos y un gráfico de
comportamiento de ventas, ambos de los últimos 6 meses) y las
pantallas completas de **Contabilidad** (Plan de Cuentas
con árbol plegable agrupado por tipo, Asientos Contables con flujo de
aprobación completo, Reportes y Periodos), **Tesorería** (Cuentas y
Caja, Conciliación Bancaria, Tarjetas de Crédito, Órdenes de Pago,
Deuda, Caja Chica, Alertas y Previsión de Liquidez), **FP&A**
(Dimensiones Analíticas, Presupuestos, Desviaciones, Simulador
What-If y Tablero de KPIs), **Cuentas por Cobrar y por Pagar**
(Clientes, Facturas de Venta, Cobros, Notas de Crédito/Débito,
Proveedores, Facturas de Compra, Pagos a Proveedores), **Inventario**
(Catálogo de Productos/Variantes, Almacenes, Stock y Valoración,
Movimientos, Transferencias, Conteos Físicos con doble aprobación,
Órdenes de Compra/Reabastecimiento y Trazabilidad de Lotes),
**Fiscal** (Impuestos y Tasas, Transacciones Fiscales, Reglas de
Riesgo, Libros Fiscales con conciliación, Facturación Electrónica,
Calendario Fiscal y Documentos Digitales), **Reportes** (Estados
Financieros con drill-down al libro mayor, Flujo de Efectivo, Antigüedad
de Saldos, Rentabilidad, Consolidación, Tablero Ejecutivo configurable,
y Exportación PDF/Excel con reportes programados) y **Métricas del
Negocio** (indicadores libres definidos por el usuario, con su
evolución en un gráfico de línea y estadísticas básicas). Los 9
módulos ya usan el mismo sistema de diseño (`frontend/DESIGN_SYSTEM.md`)
en toda su interfaz. Todas las acciones irreversibles (eliminar,
reversar, cerrar un periodo, desembolsar, cancelar) piden confirmación
antes de ejecutarse, y cada campo con jerga contable/financiera tiene
un ícono de ayuda "?" con una explicación simple. El sistema de diseño
del producto está documentado en `frontend/DESIGN_SYSTEM.md` (paleta,
tipografía, componentes base) y ya aplicado a las 9 pantallas de
módulo más la pantalla de Acceso y el Panel principal. Ver
`frontend/README.md` para ponerlo en
marcha.

## Módulo Fiscal y Localización

Completo: Motor de Impuestos, Tasas y Retenciones (por jurisdicción,
con vigencia por fecha), Validaciones Fiscales Preventivas (reglas
configurables que advierten o bloquean), Libros e Informes Fiscales
(libro de ventas, libro de compras, resumen de retenciones,
conciliación automática contra el mayor contable), Facturación
Electrónica (arquitectura extensible por adaptador, con un adaptador
de prueba MOCK listo), Calendario Fiscal con Alertas de Vencimiento
(reutiliza el motor de alertas, ahora compartido con Tesorería), y
Repositorio de Documentos Digitales (con bloqueo de eliminación si el
periodo contable ya está cerrado). Cada venta o compra fiscal genera
su asiento contable a través del mismo motor de asientos de
Contabilidad — nunca se duplica partida doble ni el registro de
auditoría. Rutas bajo `/fiscal/tax/*`, `/fiscal/transactions`,
`/fiscal/risk-rules`, `/fiscal/books/*`,
`/fiscal/electronic-documents/*`, `/fiscal/obligations/*` y
`/fiscal/documents/*`.

## Módulo de Inventario

Completo: Catálogo Maestro de Productos/Variantes/Listas de Materiales
(BOM)/Unidades de Medida, Gestión Multi-Almacén y Transferencias,
Motor de Valoración de Stock (FIFO, LIFO y Promedio Móvil Ponderado),
Movimientos de Inventario (entradas, salidas, ajustes y conteos
físicos con doble aprobación), Reabastecimiento Automático (orden de
compra borrador cuando el stock baja del mínimo, con alerta), Costo de
Productos Vendidos conectado al reporte de Rentabilidad de Reportes, y
Trazabilidad de Lotes/Vencimientos con alerta. Vender un producto con
lista de materiales descuenta automáticamente el stock de cada
componente. Todo movimiento que afecta el valor del inventario genera
su asiento contable a través del mismo motor de asientos de
Contabilidad; una transferencia entre almacenes no genera asiento
porque no cambia el valor total, solo la ubicación; las alertas de
stock bajo y vencimiento reutilizan el motor de alertas de Tesorería.
Rutas bajo `/inventory/settings`, `/inventory/units-of-measure`,
`/inventory/categories`, `/inventory/warehouses`, `/inventory/products`,
`/inventory/bom`, `/inventory/movements`, `/inventory/transfers`,
`/inventory/physical-counts`, `/inventory/stock-levels`,
`/inventory/purchase-orders` y `/inventory/lots`.

## Módulo de Cuentas por Cobrar (AR)

Completo: catálogo de Clientes, Facturación de venta (usa el motor
fiscal de impuestos/retenciones y postea el asiento automáticamente),
Cobros con soporte de pago parcial y multi-factura, Límite de Crédito
y Bloqueo (una factura se rechaza si el cliente supera su límite o
tiene facturas muy atrasadas), Cobros Conectados al Banco Real
(ligados a un movimiento bancario ya importado, que queda marcado como
conciliado) además de Anticipos sin factura asociada, Cobranza
Automatizada por Niveles de Severidad (recordatorio, aviso firme,
bloqueo automático según días de atraso, reutiliza el motor de
alertas de Tesorería), y Notas de Crédito y Débito (ligadas siempre a
la factura original, con su propio asiento contable). Rutas bajo
`/accounts-receivable/customers`, `/accounts-receivable/invoices`,
`/accounts-receivable/payments`, `/accounts-receivable/collections` y
`/accounts-receivable/credit-notes`.

## Módulo de Métricas del Negocio

Completo: a diferencia de los KPIs de FP&A (que se calculan solos a
partir del mayor contable con una fórmula), acá el usuario define un
indicador libre (ej. "Ventas del día", "Clientes nuevos") y escribe el
número directamente, sin pasar por un asiento contable. El sistema
guarda la serie de valores y calcula estadísticas simples (promedio,
mínimo, máximo, total, variación entre el primer y el último
registro) sobre lo que el usuario fue registrando. Diseñado con
PostgreSQL estándar — compatible con Supabase sin ningún cambio, ya
que Supabase también es PostgreSQL por dentro. Rutas bajo
`/business-metrics` (crear/listar/desactivar métricas,
`/business-metrics/:id/entries` para los valores, y
`/business-metrics/:id/stats` para las estadísticas).
